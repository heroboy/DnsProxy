const net = require('net')
const packet = require('dns-packet');
const dgram = require('dgram')
const DnsCache = require('./dnscache');
const PromiseSocket = require('./promise-socket');

async function queryDns(inbuf)
{
	let socket = await PromiseSocket.connect(53, '208.67.220.220');
	socket.setTimeout(4000);
	let sizeBuffer = Buffer.allocUnsafe(2);
	sizeBuffer.writeUInt16BE(inbuf.length);
	socket.write(sizeBuffer);
	socket.write(inbuf);
	sizeBuffer = await socket.read(2);
	let data = await socket.read(sizeBuffer.readUInt16BE(0));
	return data;
}

const cache = new DnsCache();
const server = dgram.createSocket('udp4');
let lastId = -1;
server.on('error', err =>
{
	console.log('dgram error', err);
});
server.on('listening', () =>
{
	console.log('server listen ok');
});
server.on('message', (msg, rinfo) =>
{
	let query = packet.decode(msg);
	if (query.id === lastId) return;
	lastId = query.id;
	let cachedResponse = cache.tryGetCache(query);
	if (cachedResponse)
	{
		for (let q of query.questions)
		{
			//console.log('[CACHE]query:', [q.name, q.type, q.class]);
		}
		server.send(cachedResponse, rinfo.port, rinfo.address);
	}
	else
	{
		for (let q of query.questions)
		{
			//console.log('[TCP]query:', [q.name, q.type, q.class]);
		}
		queryDns(msg).then(ret =>
		{
			cache.tryAddCache(query, ret);
			server.send(ret, rinfo.port, rinfo.address)
		}, err =>
			{
				console.log('queryDns error: ', query.questions[0] && query.questions[0].name, '\n', err)
			});
	}
});
server.bind(53, '0.0.0.0');
setInterval(() => { cache.tick() }, 10 * 1000).unref();

