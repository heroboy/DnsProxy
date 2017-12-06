const net = require('net');
const BufferList = require('bl')

class PromiseSocket
{

	/**@param s {NodeJS.Socket} */
	constructor(s)
	{
		/**@type {Socket} */
		this._socket = s;
		this._readAwaiter = [];
		this._closed = false;
		this._error = null;
		/**@type {Buffer} */
		this._buffer = new BufferList();

		s.on('error', e =>
		{
			if (!this._error)
			{
				this._error = e;
			}
			this._processAwaiter();
		});
		s.on('close', (ee) =>
		{
			this._closed = true;
			this._processAwaiter();
		})
		s.on('data', (data) =>
		{
			this._buffer.append(data);
			this._processAwaiter();
		});
		s.on('timeout', () =>
		{
			if (!this._error)
			{
				this._error = new Error('timeout');
			}
			this._closed = true;
			this._socket.destroy();
			this._processAwaiter();
		});
	}

	get closed()
	{
		return this._closed || this._error;
	}

	get socket()
	{
		return this._socket;
	}

	setTimeout(n)
	{
		this._socket.setTimeout(n);
	}

	/**@returns {Buffer} */
	_readBuffer(n)
	{
		if (n > 0)
		{
			let buf = this._buffer.slice(0, n);
			this._buffer.consume(n);
			return buf;
		}
		else
		{
			let buf = this._buffer.slice();
			this._buffer.consume(this._buffer.length);
			return buf;
		}
	}

	_canRead(n)
	{
		return (n > 0 && this._buffer.length >= n) || (this._buffer.length > 0);
	}

	_processAwaiter()
	{
		if (this._error || this._closed)
		{
			let e = this._error || new Error('closed');
			this._readAwaiter.forEach(obj => obj.reject(e));
			this._readAwaiter.length = 0;
			return;
		}
		while (this._readAwaiter.length > 0)
		{
			let waiter = this._readAwaiter[0];
			if (this._canRead(waiter.n))
			{
				waiter.resolve(this._readBuffer(waiter.n));
				this._readAwaiter.shift();
			}
			else
			{
				return;
			}
		}
	}

	/**@return {Promise<Buffer>} */
	read(n)
	{
		if (this._error)
			return Promise.reject(this._error);
		if (this._closed)
			return Promise.reject(new Error('error'));
		if (n > 0)
		{
			if (this._buffer.length >= n && this._readAwaiter.length == 0)
			{
				return Promise.resolve(this._readBuffer(n));
			}
		}
		else
		{
			if (this._buffer.length > 0 && this._readAwaiter.length == 0)
			{
				return Promise.resolve(this._readBuffer());
			}
		}

		let obj = { n: n, resolve: null, reject: null };
		this._readAwaiter.push(obj);
		let p = new Promise(function (resolve, reject)
		{
			obj.resolve = resolve;
			obj.reject = reject;
		});
		return p;
	}

	write(buf)
	{
		this._socket.write(buf)
	}
}

/**@return {Promise<PromiseSocket>} */
exports.connect = function (port, host)
{
	return new Promise(function (resolve, reject)
	{
		let s = net.connect(port,host);
		s.once('error',e=>{
			reject(e);
		});
		s.once('connect',()=>{
			resolve(new PromiseSocket(s));
		});
	});
}