import concurrent.futures, json, tempfile, threading, unittest, urllib.request, urllib.error, http.cookiejar, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Store, Problem, CODE, Server, Handler, digest
class LicensingTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.s=Store(self.tmp.name);self.s.setup('test-only-password-123')
 def tearDown(self):self.tmp.cleanup()
 def code(self,days=0):return self.s.generate(1,days,'客户A')[0]['code']
 def test_codes_and_no_plaintext(self):
  codes=self.s.generate(100,0,'A');self.assertEqual(100,len({x['code'] for x in codes}));self.assertTrue(all(CODE.fullmatch(x['code']) for x in codes));self.assertNotIn(codes[0]['code'],str(self.s.listing()))
 def test_binding_reinstall_disable_reenable(self):
  c=self.code();a=self.s.grant(c,'a'*64,'PC');self.assertTrue(self.s.verify(a['device_token'],'a'*64)['valid'])
  with self.assertRaises(Problem) as cm:self.s.grant(c,'b'*64,'PC2')
  self.assertEqual(cm.exception.code,'device_mismatch');b=self.s.grant(c,'a'*64,'PC');self.assertEqual(a['activated_at'],b['activated_at'])
  self.s.toggle(a['license_id'],True)
  with self.assertRaises(Problem) as cm:self.s.verify(b['device_token'],'a'*64)
  self.assertEqual(cm.exception.code,'disabled');self.s.toggle(a['license_id'],False);self.assertTrue(self.s.verify(b['device_token'],'a'*64)['valid']);self.assertGreaterEqual(len(self.s.events(a['license_id'])),6)
 def test_expiry_and_token_mismatch(self):
  c=self.code(30);a=self.s.grant(c,'a'*64,'PC');self.assertEqual(a['expires_at']-a['activated_at'],30*86400)
  with self.assertRaises(Problem):self.s.verify(a['device_token'],'b'*64)
  with self.s.db() as db:db.execute('UPDATE licenses SET expires_at=1')
  with self.assertRaises(Problem) as cm:self.s.verify(a['device_token'],'a'*64)
  self.assertEqual(cm.exception.code,'expired')
 def test_atomic_first_binding(self):
  c=self.code()
  def go(d):
   try:self.s.grant(c,d*64,'PC');return True
   except Problem:return False
  with concurrent.futures.ThreadPoolExecutor(2) as pool:self.assertEqual(sum(pool.map(go,['a','b'])),1)
 def test_rate_and_password(self):
  with self.assertRaises(Problem):self.s.login('wrong')
  token=self.s.login('test-only-password-123');self.s.admin(token)
  self.s.rate('key',1)
  with self.assertRaises(Problem):self.s.rate('key',1)
  self.s.setup('replacement-password-123')
  with self.assertRaises(Problem):self.s.admin(token)
 def test_http_auth_csrf_and_activation(self):
  server=Server(('127.0.0.1',0),Handler);server.store=self.s;server.origin='http://127.0.0.1:'+str(server.server_port);t=threading.Thread(target=server.serve_forever,daemon=True);t.start();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  def req(path,body=None,headers=None):
   return client.open(urllib.request.Request(server.origin+path,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json',**(headers or {})}))
  try:
   with self.assertRaises(urllib.error.HTTPError) as cm:req('/api/admin/licenses')
   self.assertEqual(cm.exception.code,401)
   with self.assertRaises(urllib.error.HTTPError) as cm:req('/api/admin/login',{'password':'test-only-password-123'})
   self.assertEqual(cm.exception.code,403)
   req('/api/admin/login',{'password':'test-only-password-123'},{'X-ZL-Admin':'1'})
   self.assertEqual(req('/api/admin/licenses').status,200)
   with self.assertRaises(urllib.error.HTTPError) as cm:req('/api/admin/generate',{'count':1},{'X-ZL-Admin':'1','Origin':'https://evil.invalid'})
   self.assertEqual(cm.exception.code,403)
   code=json.load(req('/api/admin/generate',{'count':1},{'X-ZL-Admin':'1'}))['codes'][0]['code']
   data=json.load(req('/api/v1/activate',{'code':code,'device_id':'c'*64,'device_name':'PC'}));self.assertTrue(data['valid'])
   verified=json.load(req('/api/v1/verify',{'device_id':'c'*64},{'Authorization':'Bearer '+data['device_token']}));self.assertTrue(verified['valid'])
   self.assertIn(b'ZL',req('/').read())
  finally:server.shutdown();server.server_close();t.join()
if __name__=='__main__':unittest.main()
