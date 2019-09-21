import axios from 'axios';
import cheerio from 'cheerio';
import * as json2csv from 'json2csv';
import * as fs from 'fs';

(async () => {
	const domain = 'https://rcdb.com';
	const region = 'r.htm?ol=1&ot=2';

	const axiosResponse = await axios.get(`${domain}/${region}`);

	const $ = cheerio.load(axiosResponse.data);

	const totalRollerCoasters = parseInt($('.int').text());
	// Assume 24 per page
	const totalPages = Math.ceil(totalRollerCoasters / 24);

	console.log('total pages', totalPages);

	const rollerCoasters: any[] = [];
	for (let page = 1; page < totalPages; page++) {
		const axiosResponsePaginated = await axios.get(`${domain}/${region}&page=${page}`);
		const paginated$ = cheerio.load(axiosResponsePaginated.data);
		const rows = paginated$('#report tbody tr');

		for (let i = 0; i < rows.length; i++) {
			const row$ = cheerio.load(rows[i]);
			const link = row$('td:nth-of-type(2) a').attr('href');

			if (link) {
				const rollerCoaster = await getDetails(`${domain}${link}`);
				console.log('link', link, rollerCoaster);
				rollerCoasters.push(rollerCoaster);
			}
		}
	}
	const csv = json2csv.parse(rollerCoasters);

	fs.writeFile('rollerCoasters.csv', csv, async (err) => {
		if (err) {
			console.log('err while saving file', err);
		}
	});

})();

export async function getDetails(detailsLink: string) {

	const axiosResponse = await axios.get(detailsLink);

	const $ = cheerio.load(axiosResponse.data);

	const rows = $('#statTable tr');

	const rollerCoaster: any = {
		name: $('#feature h1').text(),
		parkName: $('#feature .scroll:nth-of-type(1) a:nth-of-type(1)').text(),
		city: $('#feature .scroll:nth-of-type(1) a:nth-of-type(2)').text(),
		state: $('#feature .scroll:nth-of-type(1) a:nth-of-type(3)').text(),
		country: $('#feature .scroll:nth-of-type(1) a:nth-of-type(4)').text(),
		link: detailsLink,
		make: $('#feature .scroll:nth-of-type(2) a:nth-of-type(1)').text(),
		model: $('#feature .scroll:nth-of-type(2) a:nth-of-type(2)').text()
	};

	const featuredHtml = $('#feature').html();
	const operatingInfoHtml$ = cheerio.load(`<div>${featuredHtml.split('<br>')[2]}</div>`);
	const operatingMess = operatingInfoHtml$('div').text();
	if (operatingMess.toLowerCase().includes('removed')) {
		rollerCoaster.active = false;
		rollerCoaster.started = operatingInfoHtml$('div time:nth-of-type(1)').attr('datetime');
		rollerCoaster.ended = operatingInfoHtml$('div time:nth-of-type(2)').attr('datetime');
	}
	else {
		rollerCoaster.active = true;
		rollerCoaster.started = operatingInfoHtml$('div time:nth-of-type(1)').attr('datetime');
	}

	// console.log('featured stuff', operatingInfoHtml$('div').text(), `<div>${featuredHtml.split('<br>')[2]}</div>`);

	for (let i = 0; i < rows.length; i++) {
		const row$ = cheerio.load(rows[i]);
		if (row$('th').text().toLowerCase() === 'elements') {
			const elements = row$('td a');
			const elementsToPush: any[] = [];
			for (let elementIndex = 0; elementIndex < elements.length; elementIndex++) {
				elementsToPush.push(cheerio.load(elements[elementIndex])('a').text());
			}

			rollerCoaster[row$('th').text().toLowerCase()] = elementsToPush.join(', ');
		}
		else {
			rollerCoaster[row$('th').text().toLowerCase()] = row$('td').text();
		}

	}

	return Promise.resolve(rollerCoaster);



}