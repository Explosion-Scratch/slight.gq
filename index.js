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
const winston = require('winston');

const log = winston.createLogger({
  level: 'log.info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			),
			level: 'debug',
			handleExceptions: true,
			json: false,
			colorize: true,
		})
	],
});

/* winston.addColors({
	log: "green",
	error: "red",
	info: "blue",
	warn: "orange",
}); */

mongoose.connect(process.env.MONGO_URL,{
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
		useFindAndModify: false,
});

log.info("Connected to mongoDB")

var UrlSchema = new mongoose.Schema({
    url: { type: String, required: true },
		id: {type: String, index: true, unique: true},
    clicks: { type: Number, required: true },
		createdAt: {type: String, required: true},
		password: {type: Number}
})
log.info("Created UrlSchema")
UrlSchema.set('autoIndex', false);
UrlSchema.index({id: 1},  { sparse: true })

const Url = mongoose.model('Url', UrlSchema);
log.info("Created model")
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
	message: {error: "Too many requests from this IP adress. Only 100 requests every 15 minutes allowed."}
});
log.info("Created rate limiter")
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
log.info("app.use()")

require("./routes")(app, Url, log);
log.info("Routed routes");

app.get(`/list/${process.env.PASSWORD}`, async (req, res) => {
	res.json(await Url.find({}, {_id: 0, id: 1, url: 1, clicks: 1}).lean());
})

app.listen(3000, () => {
	log.info("Server listening")
});
