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

let getRangeClause = (field, range) =>{
    var clause = [];
    if (range.gte)
        clause.push(`${field} >= ${range.gte}`);
    if (range.gt)
        clause.push(`${field} > ${range.gt}`);
    if (range.lt)
        clause.push(`${field} < ${range.lt}`);
    if (range.lte)
        clause.push(`${field} <= ${range.lte}`);
    return "(" + clause.join(' AND ') + ")";
}

let executeQuery = (params, table, select, where) => {
    var sort = [],
        limit = 0,
        group = [];
    if (params) {
        if (params.sort)
            sort.push([params.sort.field, params.sort.order].join(' ')); 
        if (params.limit)
            limit = params.limit;
        if (params.group) {
            group.push(params.group.field);
            select.push([params.group.field, params.group.alias || ""].join(" "));
        }
    }
    return new Promise((resolve, reject) => {
        var q = `SELECT ${select.join(', ')}
                 FROM ${table}`;
        if (where.length)
            q = q + ' WHERE ' + clause.join(' AND ');
        if (group.length)
             q = q + ' GROUP BY ' + group.join(', ');
        if (sort.length)
            q = q + ' ORDER BY ' + sort.join(',') + ' NULLS LAST';
        if (limit > 0)
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

let filterOpportunities = (params, select) => {
    var clause = [];
    if (params) {
        if (params.salesRep)
            clause.push(`Owner.Name like '${params.salesRep}%'`);
        if (params.resolution)
            clause.push(getRangeClause('ServiceSource1__REN_Resolution_Date__c', params.resolution));
        if (params.expiration)
            clause.push(getRangeClause('ServiceSource1__REN_Earliest_Expiration_Date', params.expiration));
        if (params.salesStage)
            clause.push(`StageName IN ('${params.salesStage.join("','")}')`);
        if (params['!salesStage'])
            clause.push(`StageName NOT IN ('${params["!salesStage"].join("','")}')`);
        if (params.amount)
            clause.push(getRangeClause('amount', params.amount));
        if (params.region && params.region !== 'all')
            clause.push(`SSI_ZTH__Client_Region__c = '${params.region}'`)
        if (params.closeDate)
            clause.push(getRangeClause('closedate',params.closeDate))
    }
    return executeQuery(params, 'Opportunity', select, clause)
}

let findOpportunities = (params) => {
    console.log("Finding opportunities " + JSON.stringify(params));
    return filterOpportunities(params, ['Name', 'opportunity.account.name', 'amount', 'opportunity.owner.name']);
};

let findContacts = (params) => {
    console.log("Count deals over " + JSON.stringify(params));
    return executeQuery(params, 'Contact', ['Name', 'Email', 'Account.Name', 'FirstName'], [`Name like '${params.name}%'`]);
}

let aggregateOpportunities = (params) => {
    return filterOpportunities(params, ['Sum(Amount) totalAmount', 'Sum(ServiceSource1__REN_Renewal_Target__c) totalTargetAmount', 'Count(Name) oppCount', 'Count_Distinct(Owner.Name) repCount']);
}

let aggregateTargets = (params) => {
    console.log("Aggregate targets " + JSON.stringify(params));
    let clause = [];
    if (params) {
        if (params.salesRep)
            clause.push(`SSI_ZTH__Sales_Target__r.SSI_ZTH__Employee__r.Name like '${params.salesRep}%'`);
        if (params.period)
            clause.push(`SSI_ZTH__Sales_Target__r.SSI_ZTH__Period__r.Name = '${params.period}'`);
        if (params.periodRange)
            clause.push(getRangeClause(`SSI_ZTH__Start_Date__c`, periodRange));
    }
    return executeQuery(params, 
        'SSI_ZTH__Sales_Target_Line_Item__c', 
        ['Sum(SSI_ZTH__Target__c) totalAmount',
         'Count(Name) targetCount',
         'MIN(ssi_zth__start_date__c) minstart', 
         'MAX(ssi_zth__end_date__c) maxend'], clause);
}

let findPeriod = (params) => {
    console.log("find period " + JSON.stringify(params));
    var where = []; 
    if (params && params.period)
        where.push(`Name = '${params.period}'`)
    return executeQuery(params, 'SSI_ZTH__Period__c', ['Name', 'SSI_ZTH__Period_Start_Date__c', 'SSI_ZTH__Period_End_Date__c'], where);
}


login();

exports.org = org;
exports.findOpportunities = findOpportunities;
exports.findContacts = findContacts;
exports.findPeriodClosed = findPeriodClosed;
exports.aggregateOpportunities = aggregateOpportunities;
exports.aggregateTargets = aggregateTargets;
exports.findPeriod = findPeriod;
