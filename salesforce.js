"use strict";

let nforce = require('nforce'),

    SF_CLIENT_ID = process.env.SF_CLIENT_ID,
    SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET,
    SF_USER_NAME = process.env.SF_USER_NAME,
    SF_PASSWORD = process.env.SF_PASSWORD,
    SF_LOGIN_URL = process.env.SF_LOGIN_URL;

let org = nforce.createConnection({
    clientId: SF_CLIENT_ID,
    clientSecret: SF_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/oauth/_callback',
    mode: 'single',
    autoRefresh: true,
    loginUri: SF_LOGIN_URL
});

let login = () => {
    org.authenticate({username: SF_USER_NAME, password: SF_PASSWORD}, err => {
        if (err) {
            console.error("Authentication error");
            console.error(err);
        } else {
            console.log("Authentication successful");
        }
    });
};

let findOpportunities = (params) => {
    console.log("Finding opportunities for " + params.region + " ordered by " + params.sort);
    let where = "";
    let sort = " ORDER BY ",
        parmSort = null;
    if (params) {
        let parts = [];
        if (params.region && params.region != '' && params.region != 'all') {
            parts.push(`account.site='${params.region}'`);
        }
        parts.push('isclosed = false');
        // TODO specify current quarter
        if (parts.length>0) {
            where = "WHERE " + parts.join(' AND ');
        }
        
        parmSort = params.sort
    }
    if (parmSort && (parmSort.indexOf('probability') > -1 || parmSort.indexOf('close'))) {
        sort += 'probability DESC';
    } else {
        sort += 'amount DESC';
    }
    sort += ' NULLS LAST';
    return new Promise((resolve, reject) => {
        let q = `SELECT id,
                    opportunity.account.name,
                    amount,
                    opportunity.owner.name
                FROM opportunity
                ${where}
                ${sort}
                LIMIT 3`;
        console.log('SQL: ' + q);
        org.query({query: q}, (err, resp) => {
            if (err) {
                reject(err);
            } else {
                resolve(resp.records);
            }
        });
    });

};

let countOpportunities = (params) => {
    console.log("Count deals over " + params.bottom);
    let where = "";
    if (params) {
        let parts = [];
        if (params.bottom && params.bottom != '' && !isNaN(params.bottom)) {
            parts.push(`amount>=${params.bottom}`);
        }
        parts.push('isclosed = false');
        // TODO specify current quarter
        if (parts.length>0) {
            where = "WHERE " + parts.join(' AND ');
        }
    }
    return new Promise((resolve, reject) => {
        let q = `SELECT COUNT(id),
                    SUM(amount),
                    COUNT_DISTINCT(opportunity.owner.name)
                FROM opportunity
                ${where}`;
        console.log('SQL: ' + q);
        org.query({query: q}, (err, resp) => {
            if (err) {
                reject(err);
            } else {
                resolve(resp.records);
            }
        });
    });

};

let findContacts = (params) => {
    console.log("Count deals over " + params.name);
    return new Promise((resolve, reject) => {
        let q = `SELECT Name, Email, Account.Name
                FROM Contact
                WHERE Name like '${params.name}%'`;
        console.log('SQL: ' + q);
        org.query({query: q}, (err, resp) => {
            if (err) {
                reject(err);
            } else {
                resolve(resp.records);
            }
        });
    });
}

login();

exports.org = org;
exports.countOpportunities = countOpportunities;
exports.findOpportunities = findOpportunities;
exports.findContacts = findContacts;








