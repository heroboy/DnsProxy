const PromiseSocket = require('./promise-socket')
const SOCKET_WAIT = 200;
const DNS_TIMEOUT = 4000;
class DnsPool
{
	constructor()
	{
		this._sockets = [];
	}

	async get()
	{
		let now = Date.now();
		for (let i = 0; i < this._sockets.length; ++i)
		{
			let sobj = this._sockets[i];
			if (!sobj.socket.closed && now - sobj.puttime >= SOCKET_WAIT)
			{
				this._sockets.splice(i, 1);
				sobj.socket.setTimeout(DNS_TIMEOUT);
				return sobj.socket;
			}
		}
		let s = await PromiseSocket.connect(53, '208.67.222.222');
		s.setTimeout(DNS_TIMEOUT);
		return s;
	}

	put(s)
	{
		if (!s.closed)
		{
			s.setTimeout(0);
			this._sockets.push({
				socket: s,
				puttime: Date.now()
			});
		}
	}

	getSocketCount()
	{
		return this._sockets.length;
	}

	tick()
	{

		for (let i = 0; i < this._sockets.length; ++i)
		{
			let sobj = this._sockets[i];
			if (sobj.socket.closed)
			{
				this._sockets.splice(i, 1);
				--i;
			}
		}
	}
}

module.exports = DnsPool;