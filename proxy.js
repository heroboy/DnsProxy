const net = require('net')
const packet = require('dns-packet');
const dgram = require('dgram')
const DnsCache = require('./dnscache');
const PromiseSocket = require('./promise-socket');
const DnsPool = require('./dns-pool');
const pool = new DnsPool();
async function queryDns(inbuf)
{
	let socket = await pool.get();//await PromiseSocket.connect(53, '208.67.220.220');
	//socket.setTimeout(10000);
	let sizeBuffer = Buffer.allocUnsafe(2);
	sizeBuffer.writeUInt16BE(inbuf.length);
	socket.write(sizeBuffer);
	socket.write(inbuf);
	sizeBuffer = await socket.read(2);
	let data = await socket.read(sizeBuffer.readUInt16BE(0));
	pool.put(socket);
	return data;
}

const cache = new DnsCache();
const server = dgram.createSocket('udp4');
let lastId = -1;
let queryConcurrent = 0;
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
		++queryConcurrent;
		queryDns(msg).then(ret =>
		{
			--queryConcurrent;
			cache.tryAddCache(query, ret);
			server.send(ret, rinfo.port, rinfo.address)
		}, err =>
			{
				--queryConcurrent;
				console.log('queryDns error: ', query.questions[0] && query.questions[0].name, '\n', err)
			});
	}
});
server.bind(53, '0.0.0.0');
setInterval(() => { 
	cache.tick(); 
	pool.tick();
	
}, 10 * 1000).unref();
setInterval(()=>{
	process.title = `pool: ${pool.getSocketCount()}, querying: ${queryConcurrent}`;
},2000).unref();

