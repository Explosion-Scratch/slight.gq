const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { writeFileSync: write } = require("fs");
var loops = ["tiny.cc", "bit.ly", "go.gl", "is.gd"]

app.use(bodyParser.json({ type: "*/*" }));

app.get("/", (req, res) => res.sendFile(`${__dirname}/index.html`));
app.get("/favicon.png", (req, res) => res.sendFile(`${__dirname}/favicon.png`));
app.get("/embed.json", (_, res) => res.sendFile(`${__dirname}/embed.json`));

app.post("/shorten", (req, res) => {
	const id = req.body.id ? req.body.id.replace(/[^a-z0-9]/gi, "") : genId();
	if (id.length < 3){
		res.json({error: "Invalid ID. Id's must be above 3 characters long and contain only alphanumeric characters."})
		return;
	}
	var urls = require("./urls.json");
	if (!req.body.url) {
		res.json({ error: "No URL given." });
		return;
	}
	let urlwohttp = (new URL(req.body.url)).hostname
	let split = urlwohttp.split(".")
	urlwohttp = split.length > 2 ? `${split[split.length - 1]}.${split[split.length]}` : urlwohttp;
	for (let item of loops){
		if (urlwohttp.indexOf(item) > -1){
			res.json({error: "That URL may result in an infinite loop."});
			return;
		}
	}
	if (
		!/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(
			req.body.url,
		)
	) {
		res.json({ error: "Invalid URL recieved." });
		return;
	}
	if (urls[id]) {
		res.json({
			error: "A URL with that ID already exists. Try changing the ID?",
		});
		return;
	}
	urls[id] = {
		url: req.body.url,
		createdAt: (new Date()).toString(),
		clicks: 0,
	};
	if (req.body.password){
		urls[id].password = hash(req.body.password);
	}
	let message = `Shortened! The new URL is <a class="underline text-green-500" href="https://slight.gq/${id}">https://slight.gq/${id}</a>`
	if (req.body.password){
		message += `. To update your URL go to <a class="underline text-green-500" href="https://slight.gq/${id}/update">https://slight.gq/${id}/update</a>.`
	}
	res.json({
		message: message,
	});
	write("./urls.json", JSON.stringify(urls));
});
app.get("/:id", (req, res) => {
	var urls = require("./urls.json");
	if (!urls[req.params.id]) {
		res.json({ error: "No URL with that ID." });
		return;
	}
	if (urls[req.params.id].url){
		res.status(302).redirect(urls[req.params.id].url)
	} else {
		res.status(302).redirect(urls[req.params.id]);
	}
	if (typeof urls[req.params.id] === "string"){
		urls[req.params.id] = {
			url: urls[req.params.id],
			createdAt: (new Date()).toString(),
			clicks: 0,
		}
	}
	urls[req.params.id].clicks = (urls[req.params.id].clicks || 0) + 1;
	write("./urls.json", JSON.stringify(urls))
});
app.post("/update", (req, res) => {
	var urls = require("./urls.json");
	const id = req.body.url_id? req.body.url_id.replace(/[^a-z0-9]/gi, "") : "";
	if (!id || id.length < 3){
		res.json({error: "Invalid ID. Id's must be above 3 characters long and contain only alphanumeric characters."})
		return;
	}
	if (!req.body.url) {
		res.json({ error: "No URL given." });
		return;
	}
	if (
		!/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/.test(
			req.body.url,
		)
	) {
		res.json({ error: "Invalid URL recieved." });
		return;
	}
	if (!urls[id]){
		res.json({error: "No URL with that ID found."});
		return;
	}
	if (!id){
		res.json({error: "An ID of the URL to update needs to be given."})
	}
	if (!urls[id].url){
		res.json({error: "This URL is in the wrong format. Likely created before password encoded URLS were added."})
		return;
	}
	if (!urls[id].password){
		res.json({error: "Only password encoded URLs may be updated."})
		return;
	}
	if (!req.body.password){
		res.json({error: "Password required."});
		return;
	}
	let password = hash(req.body.password);
	if (password !== urls[id].password){
		res.json({error: "Password incorrect"});
		return;
	}
	if (req.body.id){
		if (urls[req.body.id] && req.body.id !== id){
			res.json({error: "A URL with that ID already exists."});
			return;
		}
		let old = urls[id];
		delete urls[id];
		urls[req.body.id] = {
			url: req.body.url || old.url,
			password: old.password,
			createdAt: (new Date()).toString(),
			clicks: 0,
		}
	} else {
		urls[id] = {
			url: req.body.url || urls[id].url,
			password: urls[id].password,
			createdAt: (new Date()).toString(),
			clicks: urls[id].clicks || 0
		}
	}
	write("./urls.json", JSON.stringify(urls));
	res.json({message: "URL updated!"});
})
app.get("/hash/:str", (req, res) => {
	res.json(hash(req.params.str))
})
app.get("/:id/update", (req, res) => {
	res.sendFile(`${__dirname}/update.html`);
})
function genId() {
	var firstPart = (Math.random() * 46656) | 0;
	var secondPart = (Math.random() * 46656) | 0;
	firstPart = ("000" + firstPart.toString(36)).slice(-3);
	secondPart = ("000" + secondPart.toString(36)).slice(-3);
	return firstPart + secondPart;
}
function hash(str, seed = 0) {
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
app.listen(3000);
