const net = require('net');
const packet = require('dns-packet');
var buf = packet.encode({
	type: 'query',
	id: 1,
	flags: packet.RECURSION_DESIRED,
	questions: [{
	  type: 'A',
	  name: 'baidu.com'
	}]
  })
let conn = net.createConnection(53,'208.67.222.222');
conn.on('close',e=>{
	console.log('close');
});

conn.on('data',data=>{
	console.log(data);
	conn.write(sizeBuf);
	conn.write(buf);
})
let sizeBuf = new Buffer(2);
sizeBuf.writeInt16BE(buf.length,0);
conn.write(sizeBuf);
conn.write(buf);