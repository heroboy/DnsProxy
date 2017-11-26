class DnsCache {
	constructor() {
		this.cache = {};
	}
	/**
	 * 
	 * @param {} request 
	 * @param {Buffer} response 
	 */
	tryAddCache(request, response) {
		if (request && request.questions && request.questions.length === 1 &&
			request.id === readId(response)) {
			let q = request.questions[0];
			let key = q.name + '|' + q.type + '|' + q.class;
			this.cache[key] = {
				response: response,
				time: Date.now() + 60 * 1000
			};
			return true;
		}
		return false;
	}
	tryGetCache(request){
		if (request && request.questions && request.questions.length === 1){
			let q = request.questions[0];
			let key = q.name + '|' + q.type + '|' + q.class;
			if (key in this.cache)
			{
				let entry = this.cache[key];
				writeId(entry.response,request.id);
				return entry.response;
			}
		}
		return null;
	}

	tick(){
		let cc = this.cache;
		let now = Date.now();
		for(let key of Object.keys(cc))
		{
			if (now >= cc[key].time)
			{
				delete cc[key];
			}
		}
	}
}


function readId(buf) {
	return buf.readUInt16BE(0, true);
}

/**
 * 
 * @param {Buffer} buf 
 * @param {number} id 
 */
function writeId(buf, id) {
	return buf.writeUInt16BE(id, 0);
}

module.exports = DnsCache;