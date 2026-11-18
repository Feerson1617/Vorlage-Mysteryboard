# Parse only literal data from the supplied QA HTML; never execute its JavaScript.
from pathlib import Path
import re,json,hashlib,sys
source=Path(sys.argv[1])
s=source.read_text();i=s.index('{id:`qa-medien-large`')
def value():
 global i
 if s.startswith('JSON.parse(',i):
  i+=11;result=json.loads(value());assert s[i]==')';i+=1;return result
 c=s[i];i+=1
 if c in '{[':
  out={} if c=='{' else [];end='}' if c=='{' else ']'
  while s[i]!=end:
   if c=='{':
    m=re.match(r'[A-Za-z_$][\w$]*:',s[i:]);assert m
    key=m[0][:-1];i+=len(m[0]);out[key]=value()
   else:out.append(value())
   if s[i]==',':i+=1
   else:assert s[i]==end
  i+=1;return out
 if c in '`"\'':
  start=i
  while s[i]!=c:
   if s[i]=='\\':i+=1
   i+=1
  raw=s[start:i];i+=1;assert '${' not in raw
  if c=='"':return json.loads('"'+raw+'"')
  assert not re.search(r'\\(?![nrt\\`])',raw)
  return re.sub(r'\\([nrt\\`])',lambda m:{'n':'\n','r':'\r','t':'\t','\\':'\\','`':'`'}[m[1]],raw)
 i-=1;m=re.match(r'-?\d+(?:\.\d+)?',s[i:]);assert m,s[i:i+80]
 i+=len(m[0]);return json.loads(m[0])
v=value();assert len(v['cards'])==60 and len(v['initial']['edges'])==220
out=Path(sys.argv[2]);out.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('Extracted',v['id'],len(v['cards']),len(v['initial']['edges']),out.stat().st_size)
print('Source SHA-256:',hashlib.sha256(source.read_bytes()).hexdigest())
