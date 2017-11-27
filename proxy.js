const net = require('net')
const packet = require('dns-packet');
const dgram = require('dgram')
const DnsCache = require('./dnscache');

function queryDns(inbuf) {
	return new Promise((resolve, reject) => {
		let sizeBuffer;
		let dataBuffer = Buffer.allocUnsafe(256);
		let dataSize = 0;
		let wantDataSize = 0;
		let status = 'connecting'//size,data,finished
		let sock = net.connect(53, '8.8.4.4', () => {
			if (status == 'connecting') {
				status = 'size';
				recvSize = 0;
				wantSize = 2;
				sizeBuffer = Buffer.allocUnsafe(2);
				sizeBuffer.writeUInt16BE(inbuf.length);
				sock.write(sizeBuffer);
				sock.write(inbuf);
			}
		});
		sock.setTimeout(4000);

		sock.on('data', data => {

			if (dataSize + data.length > dataBuffer.length) {
				let newBuf = Buffer.allocUnsafe(dataSize + data.length + 256);
				dataBuffer.copy(newBuf);
				dataBuffer = newBuf;
			}
			data.copy(dataBuffer, dataSize);
			dataSize += data.length;



			if (status == 'size') {
				if (dataSize >= 2) {
					wantDataSize = dataBuffer.readUInt16BE(0);
					status = 'data';
				}
			}
			if (status == 'data') {
				if (dataSize >= 2 + wantDataSize) {
					resolve(dataBuffer.slice(2, 2 + wantDataSize));
					status = 'finished';
					sock.destroy();
				}
			}
		});

		sock.on('timeout', () => {
			if (status != 'finished') {
				status = 'finished';
				reject(new Error("timeout"));
			}
			sock.destroy();
		});

		sock.on('error', e => {
			if (status != 'finished') {
				status = 'finished';
				reject(e);
			}
			sock.destroy();
		});

	});
}


const cache = new DnsCache();
const server = dgram.createSocket('udp4');
let lastId = -1;
server.on('error', err => {
	console.log('dgram error', err);
});
server.on('listening', () => {
	console.log('server listen ok');
});
server.on('message', (msg, rinfo) => {
	let query = packet.decode(msg);
	if (query.id === lastId) return;
	lastId = query.id;
	let cachedResponse = cache.tryGetCache(query);
	if (cachedResponse) {
		for (let q of query.questions) {
			//console.log('[CACHE]query:', [q.name, q.type, q.class]);
		}
		server.send(cachedResponse, rinfo.port, rinfo.address);
	}
	else {
		for (let q of query.questions) {
			//console.log('[TCP]query:', [q.name, q.type, q.class]);
		}
		queryDns(msg).then(ret => {
			cache.tryAddCache(query, ret);
			server.send(ret, rinfo.port, rinfo.address)
		}, err => {
			console.log('queryDns error:', err)
		});
	}
});
server.bind(53, '0.0.0.0');
setInterval(() => { cache.tick() }, 10 * 1000).unref();

