var expect = require('chai').expect;
var request = require('request');

it('Main page content', function (done) {
    request('http://taptools.ngrok.io', function (error, response, body) {
        expect(response.statusCode).to.equal(200);
        done();
    });
});