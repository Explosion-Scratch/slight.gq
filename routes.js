var loops = ["tiny.cc", "bit.ly", "go.gl", "is.gd"]
const _$ = require("bijou.js");
var urls = [];
module.exports = (app, Url, log) => {
	updateUrls();
	app.get("/", (req, res) => res.sendFile(`${__dirname}/index.html`));
	app.get("/noscript", (req, res) => res.sendFile(`${__dirname}/noscript.html`));
	app.get("/favicon.png", (req, res) => res.sendFile(`${__dirname}/favicon.png`));
	app.get("/embed.json", (_, res) => res.sendFile(`${__dirname}/embed.json`));

	app.post("/shorten", async (req, res) => {
		var id;
		try {
			id = req.body.id ? req.body.id.replace(/[^a-z0-9]/gi, "") : genId();
		} catch(e){
			log.error(e)
			res.json({error: e.message});
			return
		}
		if (id.length < 3){
			log.warn("Invalid ID")
			res.json({error: "Invalid ID. Id's must be above 3 characters long and contain only alphanumeric characters."})
			return;
		}
		if (!req.body.url) {
			log.warn("No URL")
			res.json({ error: "No URL given." });
			return;
		}
		if (req.body.url.includes("/watch?v=dQw4w9WgXcQ")){
			log.warn("Rickroll")
			res.json({error: "Bruh."})
		}
		if (
			!/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(
				req.body.url,
			)
		) {
			log.warn("Invalid URL")
			res.json({ error: "Invalid URL recieved." });
			return;
		}
		let urlwohttp = (new URL(req.body.url)).hostname
		let split = urlwohttp.split(".")
		urlwohttp = split.length > 2 ? `${split[split.length - 1]}.${split[split.length]}` : urlwohttp;
		for (let item of loops){
			if (urlwohttp.indexOf(item) > -1){
				log.warn("Infinite loop")
				res.json({error: "That URL may result in an infinite loop."});
				return;
			}
		}
		if (urls.find(i => i.id == id) || await Url.findOne({id: id}).lean()) {
			log.warn("Duplicate ID");
			res.json({
				error: "A URL with that ID already exists. Try changing the ID?",
			});
			return;
		}
		let url = new Url({
			id: id,
			url: req.body.url,
			createdAt: (new Date()).toString(),
			clicks: 0,
		});
		if (req.body.password){
			log.info("Password set")
			url.password = hash(req.body.password);
		}

		url.save().then(() => updateUrls(),log.info("URL Saved to database"))

		let message = `<a class="underline text-green-500" href="https://slight.gq/${id}">https://slight.gq/${id}</a>`
		if (req.body.password){
			message += `. To update your URL go to <a class="underline text-green-500" href="https://slight.gq/${id}/update">https://slight.gq/${id}/update</a>.`
		}
		res.json({
			message: message,
			url: `https://slight.gq/${id}`
		});
		log.info("Shortened")
	});
	app.get("/info/:id", async (req, res) => {
		let url = await Url.findOne(
			{id: {
				$regex: escapeRegex(req.params.id), 
				$options: "i"}
			}
		).lean();
		if (!url){
			log.info("No URL with that ID")
			let out = {error: "No URL with that ID."};
			res.json(out);
			return;
		}
		res.json(url)
	});
	app.get("/:id", async (req, res) => {
		updateUrls();
		var to = urls.find(i => (i.id ? i.id.toLowerCase() : "") == req.params.id.toLowerCase());
		if (to) {
			log.info("Cached URL found")
			res.redirect(to.url);

			Url.findOneAndUpdate(
				{id: {
					$regex: escapeRegex(req.params.id), 
					$options: "i"}
				},
				{$inc:{quantity:1,"clicks": 1}}
			).lean();
			log.info("Updated URL clicks")
			return;
		} else {
			let to = urls.map(i => i.id).filter(i => _$.jaroDistance(i, req.params.id) > .9).reduce((i, v) => _$.jaroDistance(i, req.params.id) > _$.jaroDistance(v, req.params.id) ? i : v, "");
			if (to){
				log.info("Found cached close URL")
				res.redirect(to);
				Url.findOneAndUpdate(
					{id: {
						$regex: escapeRegex(to), 
						$options: "i"}
					},
					{$inc:{quantity:1,"clicks": 1}}
				).lean();
				return;
			}
		}
		log.info("Non cached URL.")
		let url = await Url.findOneAndUpdate(
			{id: {
				$regex: escapeRegex(req.params.id), 
				$options: "i"}
			},
			{$inc:{quantity:1,"clicks": 1}}
		).lean();
		if (to) return;
		if (!url){
			let out = {error: "No URL with that ID."};
			let closest = (await Url.find({}).lean()).map(i => i.id).filter(i => _$.jaroDistance(i, req.params.id) > .9).reduce((i, v) => _$.jaroDistance(i, req.params.id) > _$.jaroDistance(v, req.params.id) ? i : v, "")
			if (closest){
				log.info("Redirecting to closest URL")
				let url = await Url.findOneAndUpdate(
					{id: {
						$regex: escapeRegex(closest), 
						$options: "i"}
					},
					{$inc:{quantity:1,"clicks": 1}}
				).lean();
				res.status(302).redirect(url.url)
				return;
			}
			log.warn("No URL found")
			res.status(404).json(out);
			return;
		}
		log.info("Non-cached url found, redirecting.")
		res.status(302).redirect(url.url)
	});
	app.put("/update", async (req, res) => {
		const id = req.body.id ? req.body.id.replace(/[^a-z0-9]/gi, "") : genId();
		log.info("Updating url")
		if (id && id.length < 3){
			log.info("Invalid ID")
			res.json({error: "Invalid ID. Id's must be above 3 characters long and contain only alphanumeric characters."})
			return;
		}
		if (!req.body.url) {
			log.info("No URL passed")
			res.json({ error: "No URL given." });
			return;
		}

		if (
			!/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(
				req.body.url,
			)
		) {
			log.info("Invalid URL")
			res.json({ error: "Invalid URL recieved." });
			return;
		}
		let urlwohttp = (new URL(req.body.url)).hostname
		let split = urlwohttp.split(".")
		urlwohttp = split.length > 2 ? `${split[split.length - 1]}.${split[split.length]}` : urlwohttp;
		for (let item of loops){
			if (urlwohttp.indexOf(item) > -1){
				log.warn("Infinite loop found")
				res.json({error: "That URL may result in an infinite loop."});
				return;
			}
		}
		try {
			const id = req.body.url_id ? req.body.url_id.replace(/[^a-z0-9]/gi, "") : "";
			var url = urls.find(i => i.id == id) || await Url.findOne({id: id}).lean();
			if (!url){
				res.json({error: "No URL with that ID"});
				return;
			}
			Url.findOneAndUpdate({id: id}, {
				url: req.body.url || url.url,
				password: url.password,
				createdAt: (new Date()).toString(),
				clicks: url.clicks || 0,
				id: req.body.id || url.id,
			}).then(updateUrls)
			res.json({message: "URL updated!"});
		} catch(e) {
			log.error(e);
			res.json({error: e.stack})
		}
	})
	app.get("/hash/:str", (req, res) => {
		res.json(hash(req.params.str))
	})
	app.get("/:id/update", (req, res) => {
		res.sendFile(`${__dirname}/update.html`);
	})
	function genId() {
		log.info("Generating random ID")
		var firstPart = (Math.random() * 46656) | 0;
		var secondPart = (Math.random() * 46656) | 0;
		firstPart = ("000" + firstPart.toString(36)).slice(-3);
		secondPart = ("000" + secondPart.toString(36)).slice(-3);
		return firstPart + secondPart;
	}
	async function updateUrls(){
		log.info("Updating cache...")
		urls = await Url.find({}, {id: 1, _id: 0, url: 1}).lean();
		log.info("Cache updated")
	}
	function hash(str, seed = 0) {
			log.info("Hashing password")
			let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
			for (let i = 0, ch; i < str.length; i++) {
					ch = str.charCodeAt(i);
					h1 = Math.imul(h1 ^ ch, 2654435761);
					h2 = Math.imul(h2 ^ ch, 1597334677);
			}
			h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
			h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
			return 4294967296 * (2097151 & h2) + (h1>>>0);
	};
	function u(req){
		log.info("Getting unique ID from request")
		var half = (str) =>[str.slice(0, Math.floor(str.length / 2)),  str.slice(Math.floor(str.length / 2))]
		let ua = `${req.headers['user-agent']}`;
		return hash(half(ua)[0]).toString(36) + hash(half(ua)[1]) + hash(req.params.id).toString(36)
	}
	function escapeRegex(string) {
			log.info("Escaped regex")
			return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	}
}