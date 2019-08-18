const http = require('http');

module.exports = {
    createServer: (app) => {
        return http.createServer(app.app);
    }
};
