"use strict";

let nforce = require('nforce'),

    SF_CLIENT_ID = process.env.SF_CLIENT_ID,
    SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET,
    SF_USER_NAME = process.env.SF_USER_NAME,
    SF_PASSWORD = process.env.SF_PASSWORD;

let org = nforce.createConnection({
    clientId: SF_CLIENT_ID,
    clientSecret: SF_CLIENT_SECRET,
    redirectUri: 'http://localhost:3000/oauth/_callback',
    mode: 'single',
    autoRefresh: true
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

let findProperties = (params) => {
    let where = "";
    if (params) {
        let parts = [];
        if (params.id) parts.push(`id='${params.id}'`);
        if (params.city) parts.push(`avohra__city__c='${params.city}'`);
        if (params.bedrooms) parts.push(`avohra__beds__c=${params.bedrooms}`);
        if (params.priceMin) parts.push(`avohra__price__c>=${params.priceMin}`);
        if (params.priceMax) parts.push(`avohra__price__c<=${params.priceMax}`);
        if (parts.length>0) {
            where = "WHERE " + parts.join(' AND ');
        }
    }
    return new Promise((resolve, reject) => {
        let q = `SELECT id,
                    avohra__title__c,
                    avohra__address__c,
                    avohra__city__c,
                    avohra__state__c,
                    avohra__price__c,
                    avohra__beds__c,
                    avohra__baths__c,
                    avohra__picture__c
                FROM avohra__property__c
                ${where}
                LIMIT 5`;
        org.query({query: q}, (err, resp) => {
            if (err) {
                reject(err);
            } else {
                resolve(resp.records);
            }
        });
    });

};

let findPriceChanges = () => {
    return new Promise((resolve, reject) => {
        let q = `SELECT
                    OldValue,
                    NewValue,
                    CreatedDate,
                    Field,
                    Parent.Id,
                    Parent.avohra__title__c,
                    Parent.avohra__address__c,
                    Parent.avohra__city__c,
                    Parent.avohra__state__c,
                    Parent.avohra__price__c,
                    Parent.avohra__beds__c,
                    Parent.avohra__baths__c,
                    Parent.avohra__picture__c
                FROM avohra__property__history
                WHERE field = 'avohra__Price__c'
                ORDER BY CreatedDate DESC
                LIMIT 3`;
        org.query({query: q}, (err, resp) => {
            if (err) {
                reject("An error as occurred");
            } else {
                console.log("Response");
                console.log(resp.records);
                resolve(resp.records);
            }
        });
    });
};


let createCase = (propertyId, customerName, customerId) => {

    return new Promise((resolve, reject) => {
        let c = nforce.createSObject('Case');
        c.set('subject', `Contact ${customerName} (Facebook Customer)`);
        c.set('description', "Facebook id: " + customerId);
        c.set('origin', 'Facebook Bot');
        c.set('status', 'New');
        c.set('avohra__Property__c', propertyId);

        org.insert({sobject: c}, err => {
            if (err) {
                console.error(err);
                reject("An error occurred while creating a case");
            } else {
                resolve(c);
            }
        });
    });

};

login();

exports.org = org;
exports.findProperties = findProperties;
exports.findPriceChanges = findPriceChanges;
exports.createCase = createCase;
exports.findTopDeals = findTopDeals;
