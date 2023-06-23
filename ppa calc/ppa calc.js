// ==UserScript==
// @name         ppa calc
// @updateURL    https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @downloadURL  https://github.com/samoore036/CF-TamperMonkey-Scripts/tree/main/cpt%20puller
// @namespace    https://github.com/samoore036/CF-TamperMonkey-Scripts
// @version      0.1
// @description  Pull planned hcs/rates and compare against ppa
// @author       mooshahe
// @match        https://fclm-portal.amazon.com/ppa/inspect/*
// @grant        GM.xmlHttpRequest
// @connect      ecft.fulfillment.a2z.com
// ==/UserScript==

const fc = document.getElementById('fcpn-site-input').value;

const activeData = new Promise(function(resolve) {
    GM.xmlHttpRequest({
        method: 'GET',
        url: getBigTableLink(),
        onreadystatechange: function(response) {
            if (response.readyState == 4 && response.status == 200) {
                resolve(this.response);
            } 
        }
    })
})

activeData.then((allPlans) => handleData(JSON.parse(allPlans)));

function handleData(allPlans) {
    const plans = new Map();
    for (const plan of allPlans) {
        // console.log(plan);
        if (plans.has(plan.fc)) {
            const existingPlans = plans.get(plan.fc);
            plans.set(plan.fc, [...existingPlans, plan.sent_timestamp_latest]);
        } else {
            const firstEntry = [];
            firstEntry.push(plan.sent_timestamp_latest);
            plans.set(plan.fc, firstEntry);
        }
    }

    console.log(plans);
}

// helper methods

// returns the link to call the api, which uses 20 hours ago from the current time 
function getBigTableLink() {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 20);

    const year = startDate.getFullYear();
    const month = startDate.getMonth() < 10 ? `0${startDate.getMonth() + 1}` : parseInt(startDate.getMonth()) + 1;
    const day = startDate.getDate() < 10 ? `0${startDate.getDate()}` : startDate.getDate();
    const hour = startDate.getHours() < 10 ? `0${startDate.getHours()}` : startDate.getHours();

    console.log(`used: ${year}-${month}-${day} and ${hour}:00:00`);

    return `https://ecft.fulfillment.a2z.com/api/NA/nssp/get_nssp_big_table_new?fcSelected=ABE4%2CACY2%2CAKR1%2CAMA1%2CCHA2%2CCHO1%2CDEN8%2CFAT2%2CFOE1%2CFTW5%2CGEG2%2CHOU8%2CHSV1%2CICT2%2CIGQ2%2CILG1%2CIND2%2CLAS6%2CLFT1%2CLGB6%2CLIT2%2CMCE1%2CMCO2%2CMDT4%2CMDW6%2CMDW9%2COKC2%2CPDX7%2CPHL6%2CPHX5%2CPHX7%2CSAT4%2CSCK1%2CSJC7%2CSLC2%2CSMF6%2CSTL3%2CSTL4%2CSWF1%2CTEB4%2CTPA3%2CYEG1&region=NA&startDate=${year}-${month}-${day}&startTime=${hour}%3A00%3A00`
}