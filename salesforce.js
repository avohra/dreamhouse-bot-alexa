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
        let q = `SELECT Name, Email, Account.Name, FirstName
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

let findWeeklyTarget = (params) => {
    console.log("Find total target for this week");
    return new Promise((resolve, reject) => {
        let q = `select MIN(ssi_zth__start_date__c) minstart, 
                    MAX(ssi_zth__end_date__c) maxend, 
                    SUM(ssi_zth__target__c) total
                FROM ssi_zth__sales_target_line_item__c
                WHERE ssi_zth__start_date__c <= TODAY 
                    AND ssi_zth__end_date__c >= TODAY`;
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

let findPeriodClosed = (params) => {
    console.log("Find total amount closed for period between " + params.minstart + " and " + params.maxend);
    let where = "";
    if (params) {
        let parts = [];
        if (params.minstart && params.minstart != '') {
            parts.push(`closedate >= ${params.minstart}`);
        }
        if (params.maxend && params.maxend != '') {
            parts.push(`closedate <= ${params.maxend}`);
        }
        parts.push('isclosed = true');
        if (parts.length>0) {
            where = "WHERE " + parts.join(' AND ');
        }
    }
    return new Promise((resolve, reject) => {
        let q = `select SUM(amount) total from opportunity ${where}`;
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

let findQuarterlyTarget = (params) => {
    console.log("Find total target for this quarter");
    return new Promise((resolve, reject) => {
        // TODO: Replace the period name with current one
        let q = `select SUM(ssi_zth__target__c) total
                FROM ssi_zth__sales_target_line_item__c
                WHERE SSI_ZTH__Sales_Target__r.SSI_ZTH__Period__r.name = '2016-Q1'`;
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

let availableOpportunities = (params) => {
    console.log("Available opps " + params);
    return new Promise((resolve, reject) => {
        let q = `SELECT Sum(Amount), Sum(ServiceSource1__REN_Renewal_Target__c)
                 FROM Opportunity
                 WHERE StageName NOT IN ('House Account') AND Owner.Name like '${process.env.SF_SALES_REP_NAME}%'`;
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

let resolvedOpportunities = (params) => {
    console.log("Resolved opps " + params);
    return new Promise((resolve, reject) => {
        let q = `SELECT Sum(Amount), Sum(ServiceSource1__REN_Renewal_Target__c)
                 FROM Opportunity
                 WHERE StageName IN ('Closed Sale', 'No Service') AND Owner.Name like '${process.env.SF_SALES_REP_NAME}%'`;
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


let closedOpportunities = (params) => {
    console.log("Closed opps " + params);
    return new Promise((resolve, reject) => {
        let q = `SELECT Sum(Amount), Sum(ServiceSource1__REN_Renewal_Target__c)
                 FROM Opportunity
                 WHERE StageName = 'Closed Sale' AND Owner.Name like '${process.env.SF_SALES_REP_NAME}%'`;
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

let targetAsOf = (params) => {
    console.log("Aggregate targets " + params);
    return new Promise((resolve, reject) => {
        let q = `SELECT Sum(SSI_ZTH__Target__c)
                 FROM SSI_ZTH__Sales_Target_Line_Item__c
                 WHERE SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name like '${process.env.SF_SALES_REP_NAME}%'`;
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
exports.findWeeklyTarget = findWeeklyTarget;
exports.findPeriodClosed = findPeriodClosed;
exports.findQuarterlyTarget = findQuarterlyTarget;
exports.availableOpportunities = availableOpportunities;
exports.closedOpportunities = closedOpportunities;
exports.resolvedOpportunities = resolvedOpportunities;
exports.targetAsOf = targetAsOf;








