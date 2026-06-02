with open('.env', 'rb') as f:
    data = f.read()
data = data.replace(b'\x00', b'')
with open('.env', 'wb') as f:
    f.write(data)
