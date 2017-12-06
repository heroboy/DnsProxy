const PromiseSocket = require('./promise-socket');
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
async function main()
{
	let s = await PromiseSocket.connect(53,'208.67.222.222');
	while(true)
	{
		let sizeBuffer = new Buffer(2);
		sizeBuffer.writeInt16BE(buf.length);
		s.write(sizeBuffer);
		s.write(buf);
		let inSizeBuf = await s.read(2);
		let data = await s.read(inSizeBuf.readUInt16BE(0));
		console.log(packet.decode(data));
	}
	
}
main();