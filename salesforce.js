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
let filterOpportunities = (params, select) => {
    let clause = [],
        sort = [],
        limit = -1;
    if (params) {
        if (params.salesRep)
            clause.push(`Owner.Name like '${params.salesRep}%'`);
        if (params.resolutionStart)
            clause.push(`ServiceSource1__REN_Resolution_Date__c >= ${params.resolutionStart}`)
        if (params.resolutionEnd)
            clause.push(`ServiceSource1__REN_Resolution_Date__c < ${params.resolutionEnd}`)
        if (params.expirationStart)
            clause.push(`ServiceSource1__REN_Earliest_Expiration_Date__c >= ${params.expirationStart}`)
        if (params.expirationEnd)
            clause.push(`ServiceSource1__REN_Earliest_Expiration_Date__c < ${params.expirationEnd}`)
        if (params.salesStage)
            clause.push(`StageName IN ('${params.salesStage.join("','")}')`)
        if (params['!salesStage'])
            clause.push(`StageName NOT IN ('${params["!salesStage"].join("','")}')`)
        if (params.ltAmount)
            clause.push(`amount < ${params.belowAmount}`)
        if (params.gteAmount)
            clause.push(`amount >= ${params.aboveAmount}`)
        if (params.gtAmount)
            clause.push(`amount > ${params.aboveAmount}`)
        if (params.sort)
            sort.push([params.sort.field, params.sort.order].join(' ')); 
        if (params.limit)
            limit = params.limit;
        if (params.region && params.region !== 'all')
            clause.push(`account.site = '${params.region}'`)
    }
    return new Promise((resolve, reject) => {
        var q = `SELECT ${select}
                 FROM Opportunity`;
        if (clause.length)
            q = q + ' WHERE ' + clause.join(' AND ');
        if (sort.length)
            q = q + ' ORDER BY ' + sort.join(',') + ' NULLS LAST';
        if (limit > -1)
            q = q + ' LIMIT ' + limit;
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
let findOpportunities = (params) => {
    console.log("Finding opportunities " + JSON.stringify(params));
    return filterOpportunities(params, "opportunity.account.name, amount, opportunity.owner.name");
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

let findPeriodClosed = (params) => {
    console.log("Find total amount closed for period:" + JSON.stringify(params));
    let where = "";
    let group = "";
    let moreFields = "";
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

        if (params.groupByRep) {
            group = 'GROUP BY owner.name';
            moreFields = ", owner.name ";
        }
    }
    return new Promise((resolve, reject) => {
        let q = `select SUM(amount) total
            ${moreFields} from opportunity ${where} ${group}`;
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

let aggregateOpportunities = (params) => {
    return filterOpportunities(params, 'Sum(Amount) totalAmount, Sum(ServiceSource1__REN_Renewal_Target__c) totalTargetAmount, Count(Name) oppCount');
}



let aggregateTargets = (params) => {
    console.log("Aggregate targets " + JSON.stringify(params));
    let clause = [];
    let moreFields = '';
    let group = '';
    if (params) {
        if (params.salesRep)
            clause.push(`SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name like '${params.salesRep}%'`);
        if (params.period)
            clause.push(`SSI_ZTH__Sales_Target__r.SSI_ZTH__Period__r.Name = '${params.period}'`);
        if (params.periodStart)
            clause.push(`SSI_ZTH__Start_Date__c >= ${params.periodStart}`);
        if (params.periodEnd)
            clause.push(`SSI_ZTH__Start_Date__c < ${params.periodEnd}`);
        if (params.dayInRange) {
            clause.push(`SSI_ZTH__Start_Date__c <= ${params.dayInRange}`);
            clause.push(`SSI_ZTH__End_Date__c >= ${params.dayInRange}`);
        }
        if (params.groupByRep) {
            moreFields = ', SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name employee ';
            group = ' GROUP BY SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name';
        }
    }
    return new Promise((resolve, reject) => {
        var q = `SELECT Sum(SSI_ZTH__Target__c) totalAmount,
                     Count(Name) targetCount,
                     MIN(ssi_zth__start_date__c) minstart, 
                     MAX(ssi_zth__end_date__c) maxend
                     ${moreFields}
                 FROM SSI_ZTH__Sales_Target_Line_Item__c`;
        if (clause.length)
            q = q + ' WHERE ' + clause.join(' AND ');
        q += group;
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

let findPeriod = (params) => {
    console.log("find period " + JSON.stringify(params));
    var where = ''; 
    if (params && params.period)
        where =` WHERE Name = '${params.period}'`
    return new Promise((resolve, reject) => {
        let q = `SELECT Name, SSI_ZTH__Period_Start_Date__c, SSI_ZTH__Period_End_Date__c
                 FROM SSI_ZTH__Period__c
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
}


login();

exports.org = org;
exports.findOpportunities = findOpportunities;
exports.findContacts = findContacts;
exports.findPeriodClosed = findPeriodClosed;
exports.aggregateOpportunities = aggregateOpportunities;
exports.aggregateTargets = aggregateTargets;
exports.findPeriod = findPeriod;
