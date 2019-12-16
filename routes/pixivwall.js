const express = require('express');
const {sample} = require('lodash');

const router = express.Router();
const state = {
	images: [],
};

router.post('/images', (req, res) => {
	const images = req.body;
	if (!Array.isArray(images) || images.some((image) => typeof image !== 'string')) {
		res.sendStatus(400);
		return;
	}
	state.images = images.slice(0, 200);
	res.sendStatus(200);
});

router.get('/random', (req, res) => {
	if (state.images.length === 0) {
		res.sendStatus(404);
		return;
	}
	const image = sample(state.images);
	res.redirect(302, `https://pixiv.re/${image}.jpg`);
});

module.exports = router;
