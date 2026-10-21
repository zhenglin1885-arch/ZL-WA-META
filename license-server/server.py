"""ZL licensing service. Python 3.10+, no third-party packages."""
import argparse, contextlib, getpass, hashlib, hmac, http.cookies, json, os, re, secrets, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

ROOT = Path(__file__).resolve().parent
CODE = re.compile(r'(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{8}\Z')
DEVICE = re.compile(r'[a-f0-9]{64}\Z')
RECHECK = 21600

def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def password_hash(password, salt): return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
class Problem(Exception):
    def __init__(self, status, code, message): self.status, self.code, self.message = status, code, message

class Store:
    def __init__(self, folder):
        self.folder = Path(folder); self.folder.mkdir(parents=True, exist_ok=True)
        self.path = self.folder / 'licenses.sqlite3'
        with self.db() as c:
            c.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, password TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, tail TEXT NOT NULL, label TEXT NOT NULL, duration_days INTEGER NOT NULL, created_at INTEGER NOT NULL, activated_at INTEGER, expires_at INTEGER, device_hash TEXT, device_name TEXT, last_seen INTEGER, disabled INTEGER NOT NULL DEFAULT 0, token_hash TEXT UNIQUE);
            CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, license_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
            ''')
        try: os.chmod(self.path, 0o600)
        except OSError: pass
    @contextlib.contextmanager
    def db(self):
        c = sqlite3.connect(self.path, timeout=15); c.row_factory = sqlite3.Row
        try:
            with c: yield c
        finally: c.close()
    def audit(self, c, lid, action, detail=''):
        c.execute('INSERT INTO events(license_id,action,detail,created_at) VALUES(?,?,?,?)', (lid,action,detail,int(time.time())))
    def setup(self, password):
        if len(password) < 12: raise ValueError('管理员密码至少 12 位')
        salt = secrets.token_hex(16)
        with self.db() as c:
            c.execute('INSERT OR REPLACE INTO admin VALUES(1,?,?)', (salt,password_hash(password,salt)))
            c.execute('DELETE FROM sessions'); self.audit(c,None,'admin_password_changed')
    def rate(self, key, maximum=30, seconds=900):
        now=int(time.time())
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('DELETE FROM limits WHERE reset < ?', (now,))
            c.execute('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key,now+seconds))
            count=c.execute('SELECT count FROM limits WHERE key=?',(key,)).fetchone()[0]
        if count>maximum: raise Problem(429,'rate_limited','请求过多，请稍后再试')
    def login(self, password):
        with self.db() as c:
            a=c.execute('SELECT * FROM admin WHERE id=1').fetchone()
            if not a or not hmac.compare_digest(a['password'],password_hash(password,a['salt'])): raise Problem(401,'login_failed','密码不正确')
            token=secrets.token_urlsafe(32); now=int(time.time())
            c.execute('DELETE FROM sessions WHERE expires<?',(now,))
            c.execute('INSERT INTO sessions VALUES(?,?)',(digest(token),now+8*3600)); self.audit(c,None,'admin_login')
            return token
    def admin(self, token):
        with self.db() as c:
            if not token or not c.execute('SELECT 1 FROM sessions WHERE token=? AND expires>?',(digest(token),int(time.time()))).fetchone(): raise Problem(401,'login_required','请登录管理后台')
    def generate(self, count, days, label):
        if type(count) is not int or not 1<=count<=100 or type(days) is not int or not 0<=days<=36500: raise Problem(400,'invalid_input','数量须为 1–100，有效天数须为 0–36500；0 表示永久')
        codes=[]; now=int(time.time())
        with self.db() as c:
            for _ in range(count):
                for attempt in range(100):
                    code=''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') for _ in range(8))
                    if not CODE.fullmatch(code): continue
                    lid=secrets.token_hex(12)
                    try: c.execute('INSERT INTO licenses(id,code_hash,tail,label,duration_days,created_at) VALUES(?,?,?,?,?,?)',(lid,digest(code),code[-4:],label[:120],days,now))
                    except sqlite3.IntegrityError: continue
                    codes.append({'id':lid,'code':code}); self.audit(c,lid,'created'); break
                else: raise RuntimeError('Code generation failed')
        return codes
    def status(self,r):
        if r['disabled']: return 'disabled'
        if r['expires_at'] and r['expires_at']<=int(time.time()): return 'expired'
        return 'active' if r['activated_at'] else 'unused'
    def listing(self):
        with self.db() as c:
            rows=c.execute('SELECT id,tail,label,duration_days,created_at,activated_at,expires_at,device_hash,device_name,last_seen,disabled FROM licenses ORDER BY created_at DESC,id DESC').fetchall()
        result=[]
        for r in rows:
            item=dict(r);item['status']=self.status(r);item['code']='****'+item.pop('tail');result.append(item)
        return result
    def toggle(self,lid,disabled):
        if type(disabled) is not bool: raise Problem(400,'invalid_input','状态无效')
        with self.db() as c:
            if not c.execute('SELECT 1 FROM licenses WHERE id=?',(lid,)).fetchone(): raise Problem(404,'not_found','激活码不存在')
            c.execute('UPDATE licenses SET disabled=? WHERE id=?',(int(disabled),lid));self.audit(c,lid,'disabled' if disabled else 'enabled')
    def events(self,lid):
        with self.db() as c: return [dict(r) for r in c.execute('SELECT action,detail,created_at FROM events WHERE license_id=? ORDER BY id DESC LIMIT 100',(lid,))]
    def entitlement(self,r):
        return {'valid':True,'license_id':r['id'],'activated_at':r['activated_at'],'expires_at':r['expires_at'],'server_time':int(time.time()),'recheck_after_seconds':RECHECK,'valid_until':min(int(time.time())+RECHECK,r['expires_at'] or int(time.time())+RECHECK)}
    def grant(self,code,device,name):
        if not CODE.fullmatch(code) or not DEVICE.fullmatch(device): raise Problem(400,'invalid_input','激活码须为 8 位大写字母和数字组合，设备标识须为 SHA-256')
        failure=None; result=None
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            r=c.execute('SELECT * FROM licenses WHERE code_hash=?',(digest(code),)).fetchone()
            if not r: raise Problem(403,'invalid_code','激活码不存在')
            status=self.status(r)
            if status in ('disabled','expired'): failure=Problem(403,status,'激活码已停用或过期')
            elif r['device_hash'] and r['device_hash']!=device: failure=Problem(403,'device_mismatch','激活码已绑定另一台设备')
            if failure: self.audit(c,r['id'],'activation_denied',failure.code)
            else:
                now=int(time.time()); token=secrets.token_urlsafe(32); first=r['activated_at'] is None
                activated=r['activated_at'] or now; expires=r['expires_at'] or (activated+r['duration_days']*86400 if r['duration_days'] else None)
                c.execute('UPDATE licenses SET activated_at=?,expires_at=?,device_hash=?,device_name=?,last_seen=?,token_hash=? WHERE id=?',(activated,expires,device,name[:80],now,digest(token),r['id']))
                self.audit(c,r['id'],'activated' if first else 'reactivated')
                result=self.entitlement(c.execute('SELECT * FROM licenses WHERE id=?',(r['id'],)).fetchone());result['device_token']=token
        if failure: raise failure
        return result
    def verify(self,token,device):
        if not token or len(token)>200 or not DEVICE.fullmatch(device): raise Problem(403,'invalid_token','设备授权无效')
        failure=None; result=None
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            r=c.execute('SELECT * FROM licenses WHERE token_hash=?',(digest(token),)).fetchone()
            if not r: raise Problem(403,'invalid_token','设备授权不存在，请重新激活')
            if r['device_hash']!=device: failure=Problem(403,'device_mismatch','设备不匹配')
            elif self.status(r)!='active': failure=Problem(403,self.status(r),'授权已停用或过期')
            if failure: self.audit(c,r['id'],'verification_denied',failure.code)
            else:
                c.execute('UPDATE licenses SET last_seen=? WHERE id=?',(int(time.time()),r['id']))
                self.audit(c,r['id'],'verified');result=self.entitlement(r)
        if failure: raise failure
        return result

class Handler(BaseHTTPRequestHandler):
    server_version='ZL-License/1.0'
    def log_message(self,*args): pass  # Never log passwords, codes, tokens, or request bodies.
    def respond(self,status,data,headers=None,mime='application/json; charset=utf-8'):
        body=json.dumps(data,ensure_ascii=False).encode() if mime.startswith('application/json') else data
        self.send_response(status)
        for k,v in {'Content-Type':mime,'Content-Length':str(len(body)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",**(headers or {})}.items(): self.send_header(k,v)
        self.end_headers();self.wfile.write(body)
    def cookie(self):
        try:
            c=http.cookies.SimpleCookie(self.headers.get('Cookie',''));return c['zl_admin'].value if 'zl_admin' in c else ''
        except http.cookies.CookieError:return ''
    def do_GET(self):self.handle_api(False)
    def do_POST(self):self.handle_api(True)
    def handle_api(self,post):
        try:
            path=urlsplit(self.path).path;s=self.server.store
            if not post and path in ('/','/admin.js','/admin.css'):
                file={'/':'index.html','/admin.js':'admin.js','/admin.css':'admin.css'}[path]
                mime={'/':'text/html; charset=utf-8','/admin.js':'text/javascript; charset=utf-8','/admin.css':'text/css; charset=utf-8'}[path]
                return self.respond(200,(ROOT/'web'/file).read_bytes(),mime=mime)
            if not post and path=='/health':return self.respond(200,{'status':'ok'})
            body={}
            if post:
                try: size=int(self.headers.get('Content-Length','0'))
                except ValueError:raise Problem(400,'invalid_body','无效请求')
                if not 0<size<=16384:raise Problem(413,'body_too_large','请求体过大或为空')
                if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise Problem(415,'json_required','需要 JSON 请求')
                try:body=json.loads(self.rfile.read(size))
                except (ValueError,UnicodeDecodeError):raise Problem(400,'invalid_body','无效 JSON')
                if not isinstance(body,dict):raise Problem(400,'invalid_body','需要 JSON 对象')
            if path.startswith('/api/admin/'):
                if post and (self.headers.get('X-ZL-Admin')!='1' or (self.headers.get('Origin') and self.headers['Origin']!=self.server.origin)):raise Problem(403,'origin_denied','无效管理请求来源')
                if post and path=='/api/admin/login':
                    s.rate('login:'+digest(self.client_address[0]),10)
                    pw=body.get('password','')
                    if not isinstance(pw,str) or len(pw)>1024:raise Problem(400,'invalid_input','无效密码')
                    token=s.login(pw);secure='; Secure' if self.server.origin.startswith('https:') else ''
                    return self.respond(200,{'ok':True},{'Set-Cookie':'zl_admin='+token+'; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=28800'+secure})
                s.admin(self.cookie())
                if not post and path=='/api/admin/licenses':return self.respond(200,{'licenses':s.listing()})
                if not post and path=='/api/admin/events':return self.respond(200,{'events':s.events(parse_qs(urlsplit(self.path).query).get('id',[''])[0])})
                if post and path=='/api/admin/generate':
                    label=body.get('label','')
                    if not isinstance(label,str):raise Problem(400,'invalid_input','备注无效')
                    return self.respond(201,{'codes':s.generate(body.get('count'),body.get('duration_days',0),label)})
                if post and path=='/api/admin/toggle':
                    if not isinstance(body.get('id'),str):raise Problem(400,'invalid_input','无效激活码 ID')
                    s.toggle(body['id'],body.get('disabled'));return self.respond(200,{'ok':True})
                if post and path=='/api/admin/logout':
                    with s.db() as c:c.execute('DELETE FROM sessions WHERE token=?',(digest(self.cookie()),))
                    return self.respond(200,{'ok':True},{'Set-Cookie':'zl_admin=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0'})
            if post and path in ('/api/v1/activate','/api/v1/verify'):
                s.rate('client:'+digest(self.client_address[0]),120)
                for key in ('code','device_id','device_name'):
                    if not isinstance(body.get(key,''),str) or len(body.get(key,''))>200:raise Problem(400,'invalid_input','字段无效')
                if path.endswith('activate'):
                    s.rate('activate:'+digest(self.client_address[0]),20)
                    return self.respond(200,s.grant(body.get('code',''),body.get('device_id',''),body.get('device_name','')))
                auth=self.headers.get('Authorization','')
                return self.respond(200,s.verify(auth[7:] if auth.startswith('Bearer ') else '',body.get('device_id','')))
            raise Problem(404,'not_found','接口不存在')
        except Problem as e:self.respond(e.status,{'error':e.code,'message':e.message})
        except Exception:self.respond(500,{'error':'server_error','message':'服务暂不可用，请稍后重试'})

class Server(ThreadingHTTPServer):
    daemon_threads=True
    def get_request(self):
        sock,addr=super().get_request();sock.settimeout(15);return sock,addr

def main():
    p=argparse.ArgumentParser();p.add_argument('--data',default=str(ROOT/'data'));p.add_argument('--init',action='store_true');p.add_argument('--reset-password',action='store_true');p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=8787);p.add_argument('--origin',default='http://127.0.0.1:8787');args=p.parse_args();store=Store(args.data)
    with store.db() as c:exists=c.execute('SELECT 1 FROM admin').fetchone()
    if args.init or args.reset_password:
        if exists and not args.reset_password:raise SystemExit('管理员已存在；如需重置请使用 --reset-password')
        a=getpass.getpass('设置管理员密码（至少12位）: ');b=getpass.getpass('再次输入: ')
        if a!=b:raise SystemExit('密码不一致')
        store.setup(a);print('管理员密码已设置。');return
    if not exists:raise SystemExit('请先执行 python server.py --init')
    if args.origin.startswith('http:') and args.host not in ('127.0.0.1','localhost','::1'):raise SystemExit('远程部署必须配置 https:// 公网 origin，并通过 HTTPS 反向代理提供访问')
    server=Server((args.host,args.port),Handler);server.store=store;server.origin=args.origin.rstrip('/');print('ZL 管理后台: '+server.origin,flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
