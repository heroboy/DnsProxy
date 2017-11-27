const assert = require('assert');
const packet = require('dns-packet');
const CACHE_TIME = 60 * 1000;
class DnsCache
{
	/**
	 * @typedef {Object} Cache
	 * @prop {Buffer} response
	 * @prop {number} expired
	 * @prop {number} cacheTime
	 * @prop {Object} parsedResponse
	 */

	constructor()
	{
		/**@type {{[x:string]:Cache}} */
		this.cache = {};
		/**@type {{[x:string]:Cache}} */
		this.expiredCache = {};
	}
	/**
	 * 
	 * @param {} request 
	 * @param {Buffer} response 
	 */
	tryAddCache(request, response)
	{
		if (isCachableRequest(request) &&
			request.id === readId(response))
		{
			let parsedResponse = packet.decode(response);
			if (!parsedResponse) return false;
			let q = request.questions[0];
			let key = q.name + '|' + q.type + '|' + q.class;

			if (this.expiredCache[key])
			{
				let cache = this.expiredCache[key];
				assert(cache.parsedResponse, 'parsedResponse is missing');
				if (isSameResponse(cache.parsedResponse, parsedResponse))
				{
					cache.cacheTime += CACHE_TIME;
					cache.expired = Date.now() + cache.cacheTime;
					this.cache[key] = cache;
					delete this.expiredCache[key];
					console.log('[ADD CACHE]', key, ',time:', this.cache[key].cacheTime / 1000);
					return true;
				}
				else
				{
					delete this.cache[key];
					delete this.expiredCache[key];
					return false;
				}
			}
			else
			{
				let cache;
				if (this.cache[key])
				{
					cache = this.cache[key];
					cache.expired = Date.now() + CACHE_TIME;
				}
				else
				{
					this.cache[key] = {
						response: response,
						parsedResponse: parsedResponse,
						expired: Date.now() + CACHE_TIME,
						cacheTime: CACHE_TIME
					};
				}
				console.log('[ADD CACHE]', key, ',time:', this.cache[key].cacheTime / 1000);
				return true;
			}
			console.log('[NO CACHE]', key);
			return false;
		}
		console.log('[NO CACHE]', 'error question');
		return false;
	}

	tryGetCache(request)
	{
		if (isCachableRequest(request))
		{
			let q = request.questions[0];
			let key = q.name + '|' + q.type + '|' + q.class;
			if (key in this.cache)
			{
				let entry = this.cache[key];
				writeId(entry.response, request.id);
				console.log('[GET CACHE]', key);
				return entry.response;
			}
		}
		else
		{
			for (let q in request.questions)
			{
				let key = q.name + '|' + q.type + '|' + q.class;
				console.log('[CACHE MISS]', key);
			}
		}
		return null;
	}

	tick()
	{
		let cc = this.cache;
		let now = Date.now();
		for (let key of Object.keys(cc))
		{
			if (now >= cc[key].expired)
			{
				this.expiredCache[key] = cc[key];
				delete cc[key];
			}
		}
	}
}


function readId(buf)
{
	return buf.readUInt16BE(0, true);
}

/**
 * 
 * @param {Buffer} buf 
 * @param {number} id 
 */
function writeId(buf, id)
{
	return buf.writeUInt16BE(id, 0);
}


function isCachableRequest(request)
{
	return request && request.questions && request.questions.length === 1
}

function isSameResponse(sp1, sp2)
{
	if (sp1.flags === sp2.flags)
	{
		let ans1 = sp1.answers;
		let ans2 = sp2.answers;
		if (ans1 === ans2) return true;
		if (ans1.length === ans2.length)
		{
			let count = ans1.length;
			for (let i = 0; i < count; ++i)
			{
				let a1 = ans1[i];
				let a2 = ans2[i];
				if (a1.name === a2.name && a1.type === a2.type && a1.class === a2.class)
				{
					if (typeof a1.data === 'string' && a1.data === a2.data) return true;
					//else: a1.data is Buffer and a2.data is Buffer
				}
			}
		}
	}
	return false;
}


module.exports = DnsCache;