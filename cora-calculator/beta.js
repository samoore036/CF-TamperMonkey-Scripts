// ==UserScript==
// @name         CORA TRB Tracker
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/blob/main/dwell-callouts/cpt-dwells.js
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      1.0
// @description  Display TRB status and calculate mitigation in CORA
// @author       mooshahe
// @match        https://outboundflow-iad.amazon.com/*
// @grant        GM.xmlHttpRequest
// @connect      trb-na.corp.amazon.com
// ==/UserScript==

// all of the risk information for trbs
const trbData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://trb-na.corp.amazon.com/api/statusTable',
        onreadystatechange: function(response) {
            if (response.readyState === 4 && response.status === 200) {
                resolve(this.response);
            } else {
                console.log('status table pull unsuccessful');
            }
        }
    })
});

// processing times are required to see who is actually on trb as the above api returns every site
const processingTimes = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: 'https://trb-na.corp.amazon.com/api/fcProcessingTimes',
        onreadystatechange: function(response) {
            if (response.readyState === 4 && response.status === 200) {
                resolve(this.response);
            } else {
                console.log('processing time pull unsuccessful');
            }
        }
    })
});

Promise.all([trbData, processingTimes]).then(data => loadScript(data));

function loadScript(data) {
    if (!data[0] || !data[1]) {
        function displayError();
    }

    let fc = document.URL.split('/')[3];

    let apiData = data[0].replaceAll('[', '').replaceAll(']', '').split('{');
    const trbAllData = apiData.filter(string => string !== '').map(stringData => jsonify(stringData));
    const processTimes = JSON.parse(data[1]);
    
    //the api returns trbs for all ship options but the only one we are concerned with is default shipping 
    const actualTrbs = trbAllData
                        .filter(trb => trb.shipOption === 'default')
                        .filter(trb => isOnTrb(trb.timeToCpt, processTimes[trb.fc].default));

    /**************
     Helper Methods
    **************/
    //JSON.parse throws a syntax error so manually stringifying to turn into an object
    function stringify(str) {
        const strArr = str.split(',');
        return strArr;
    }

    //turn array of strings into an object
    function jsonify(str) {
        const strArr = stringify(str);

        let fc = beautifyString(strArr[0].split(':')[1]);
        let cpt = `${beautifyString(strArr[3].split(':')[1])}${beautifyString(strArr[4])}`
        let timeToCpt = beautifyString(strArr[9].split(':')[1]);   
        let risk = beautifyString(strArr[8].split(':')[1]);
        let shipOption = beautifyString(strArr[10].split(':')[1]);
        let packGroup = beautifyString(strArr[11].split(':')[1]);
        return {
            fc: fc,
            cpt: cpt,
            timeToCpt: timeToCpt,
            risk: risk,
            shipOption: shipOption,
            packGroup: packGroup
        }
    }

    // the api is a plain text file that has escape characters and quotes that need to be replaced
    function beautifyString(str) {
        return str.replaceAll('"', '').replaceAll('\\', '');
    }

    // checks time to cpt against processing time. if time to cpt is greater than processing time, site is on trb
    function isOnTrb(timeToCpt, processingTime) {
        return timeToCpt > processingTime;
    }

    function displayError() {
        const divToReplace = document.getElementsByClassName('node')[0].querySelectorAll('div')[1].querySelectorAll('div')[0];
        divToReplace.textContent = '';
    }
}