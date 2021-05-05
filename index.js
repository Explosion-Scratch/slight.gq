const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { writeFileSync: write } = require("fs");
const cors = require("cors");
const session = require("express-session");
const mongoose = require('mongoose');
const MongoStore = require("connect-mongo");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

mongoose.connect(process.env.MONGO_URL,{
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
		useFindAndModify: false,
});
var UrlSchema = new mongoose.Schema({
    url: { type: String, required: true },
		id: {type: String, index: true, unique: true},
    clicks: { type: Number, required: true },
		createdAt: {type: String, required: true},
		password: {type: Number}
})

UrlSchema.set('autoIndex', false);
UrlSchema.index({id: 1},  { sparse: true })

const Url = mongoose.model('Url', UrlSchema);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
	message: {error: "Too many requests from this IP adress. Only 100 requests every 15 minutes allowed."}
});

app.use(limiter)
app.set("json spaces", 2);
app.use(cors());
app.use(morgan('dev'))

// body parser accept JSON as default and url encoded from noscript form.
app.use(bodyParser.json({ type: ["text/plain", "*/json"] }));
app.use(bodyParser.urlencoded({type: "application/x-www-form-urlencoded"}))

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongooseConnection: mongoose.connection,
      mongoUrl: process.env.MONGO_URL
    })
  })
);

require("./routes")(app, Url);

app.get(`/list/${process.env.PASSWORD}`, async (req, res) => {
	res.json(await Url.find({}).lean());
})

app.listen(3000, () => {
	console.log("Server listening")
	setTimeout(console.clear, 1000)
});
