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




(() => {
    /****************\
    |global variables|
    \****************/
    const fc = document.getElementById('fcpn-site-input').value;
    const planTimes = [];
    setupDom();
    
    // check if the slam pad time is stored in local storage. if not then prompt user to enter the schedule
    // keys are stored as fc and values are the slam pad time in minutes
    if (!localStorage.getItem(`${fc}`)) {
        openModal();
    } else {
        
    }

    


    getPlanTimes(getBigTableLink());
    console.log(planTimes);

    // calls the big table data and filters for the plan times of the specific fc
    function getPlanTimes(link) {
        const activeData = new Promise(function(resolve) {
            GM.xmlHttpRequest({
                method: 'GET',
                url: link,
                onreadystatechange: function(response) {
                    if (response.readyState == 4 && response.status == 200) {
                        resolve(this.response);
                    } 
                }
            })
        }).then((data) => getFcPlanTimes(data, fc));
    }

    // plan times are added to the global planTimes array
    function getFcPlanTimes(data, fc) {
        const allPlans = JSON.parse(data);
        for (const plan of allPlans) {
            if (plan.fc === fc) {
                planTimes.push(plan.sent_timestamp_latest);
            }
        }
    }

    // returns the link to call the big table api, which uses 20 hours ago from the current time 
    function getBigTableLink() {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 20);

        const year = startDate.getFullYear();
        const month = parseInt(startDate.getMonth()) + 1 < 10 ? `0${parseInt(startDate.getMonth()) + 1}` : parseInt(startDate.getMonth()) + 1;
        const day = startDate.getDate() < 10 ? `0${startDate.getDate()}` : startDate.getDate();
        const hour = startDate.getHours() < 10 ? `0${startDate.getHours()}` : startDate.getHours();

        console.log(`used: ${year}-${month}-${day} and ${hour}:00:00`);

        return `https://ecft.fulfillment.a2z.com/api/NA/nssp/get_nssp_big_table_new?fcSelected=ABE4%2CACY2%2CAKR1%2CAMA1%2CCHA2%2CCHO1%2CDEN8%2CFAT2%2CFOE1%2CFTW5%2CGEG2%2CHOU8%2CHSV1%2CICT2%2CIGQ2%2CILG1%2CIND2%2CLAS6%2CLFT1%2CLGB6%2CLIT2%2CMCE1%2CMCO2%2CMDT4%2CMDW6%2CMDW9%2COKC2%2CPDX7%2CPHL6%2CPHX5%2CPHX7%2CSAT4%2CSCK1%2CSJC7%2CSLC2%2CSMF6%2CSTL3%2CSTL4%2CSWF1%2CTEB4%2CTPA3%2CYEG1&region=NA&startDate=${year}-${month}-${day}&startTime=${hour}%3A00%3A00`
    }


    /****************\
    |DOM manipulation|
    \****************/

    function setupDom() {
        document.body.appendChild(makeModal());
    }

    function makeModal() {
        const modal = document.createElement('div');
        modal.setAttribute('id', 'modal');
        // modal.style.display = 'none';
        modal.appendChild(makeCloseSettingsBtn());
        
        const prompt = document.createElement('p');
        prompt.textContent = `Please enter period/quarter start/end times`;
        prompt.style.cssText+= 'font-size: 1.7rem; text-align: center;';
        modal.appendChild(prompt);

        const timeDiv = document.createElement('div');
        timeDiv.setAttribute('id', 'modal-input-div');
        timeDiv.style.cssText += `display: flex; flex-direction: column; gap: 1rem;`
        for (let i = 1; i < 6; i++) {
            timeDiv.appendChild(makeTimeInputDiv(i));
        }
        modal.appendChild(timeDiv);
    
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText += `
            align-self: center; width: 15rem; margin-top: 1rem;
            color: black; background-color: white; font-size: 1.5rem;
        `
        saveButton.addEventListener('click', saveModalSettings);
        timeDiv.appendChild(saveButton);

        return modal;
    }

    function makeCloseSettingsBtn() {
        const button = document.createElement('button');
        button.setAttribute('id', 'close-btn');
        button.style.cssText += `
            position: relative; bottom: 3rem; left: 36.7rem;
            border: medium none;
            font-size: 1.7rem; width: 2.5rem; height: 2.5rem;
            color: white; background-color: rgb(220, 38, 38);
            cursor: pointer;
        `
        button.textContent = '✖';
        button.addEventListener('click', closeModal);

        return button;
    }
    
    function makeSLABar() {
        const slaDiv = document.createElement('div');
        slaDiv.setAttribute('id', 'sla-div');
        slaDiv.style.display = 'flex';
        slaDiv.style.gap = '5px';
        slaDiv.style.marginLeft = '4vw';
    
        const message = document.createElement('p');
        message.textContent = `Current SLA is ${localStorage.getItem(`${fc}`)} minutes`;
        message.style.backgroundColor = '#fdba74';
        message.style.border = '2px solid #fb923c';
        message.style.fontSize = '0.9rem';
        message.style.padding = '0.3rem';
        slaDiv.appendChild(message);
    
        const changeButton = document.createElement('button');
        changeButton.textContent = 'change';
        changeButton.style.cssText += `
            display: flex; align-items: center;
            height: 80%; 
        `
        changeButton.addEventListener('click', openSLAModal);
        slaDiv.appendChild(changeButton);
    
        return slaDiv;
    }

    /*************\
    |DOM factories|
    \*************/
    
    function makeTimeInputDiv(number) {
        const div = document.createElement('div');
        div.style.cssText += `display:flex; gap: 1rem;`;

        const titleDiv = document.createElement('div');
        titleDiv.textContent = `P/Q${number}`;
        titleDiv.style.cssText += `display: flex; justify-content: center; align-items: end; margin-bottom: 3px;`
        div.appendChild(titleDiv);

        const startDiv = document.createElement('div');
        const startPrompt = document.createElement('div');
        startPrompt.textContent = 'Start time:';
        startDiv.appendChild(startPrompt);
        const startInput = document.createElement('input');
        startInput.style.color = 'black';
        startInput.placeholder = 'ex: 07:30';
        startDiv.appendChild(startInput);
        div.appendChild(startDiv);

        const endDiv = document.createElement('div');
        const endPrompt = document.createElement('div');
        endPrompt.textContent = 'End time:';
        endDiv.appendChild(endPrompt);
        const endInput = document.createElement('input');
        endInput.style.color = 'black';
        endInput.placeholder = 'ex: 09:45';
        endDiv.appendChild(endInput);
        div.appendChild(endDiv);

        return div;
    }

    function makeCustomTimeDiv() {
        const div = document.createElement('div');


        return div;
    }

    function makeButtonDiv(name, timeRange) {
        const div = document.createElement('div');
        div.textContent = name;

        return div;
    }

    /*****************\
    |DOM element logic|
    \*****************/

    function openModal() {
        const modal = document.getElementById('modal');
        modal.style.zIndex = '1000';
        modal.style.position = 'fixed';
        modal.style.top = '30%';
        modal.style.left = '35%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.justifyContent = 'center';
        modal.style.padding = '3rem';
        modal.style.color = 'white';
    
        // const slaDiv = document.getElementById('sla-div');
        // slaDiv.remove();
    }

    function closeModal() {
        const modal = document.getElementById('modal');
        modal.style.display = 'none';
    }   

    function saveModalSettings(e) {
        const parentElement = e.target.parentElement;
    
        // prompt user if input is invalid 
        if (currentSLA.length !== 0 ) {
            if (isNaN(currentSLA)) {
                const errorMessage = document.createElement('p');
                errorMessage.textContent = 'Please enter a valid number.'
                errorMessage.style.cssText += `
                    color: red; font-weight:bold;
                    position: absolute; bottom: 1vw; text-align: center;
                    margin: auto; left: 0; right: 0;
                `
                parentElement.appendChild(errorMessage);
                return;
            }
        } 
        
        // if it all checks out and a number was input, update local storage
        if (!isNaN(currentSLA) && currentSLA.length !== 0) {
            localStorage.setItem(`${fc}`, currentSLA);
        }
        
        parentElement.style.display = 'none';
    
        const parent = document.getElementsByClassName('rodeo-navigation-links')[0];
        parent.style.display = 'flex';
        parent.appendChild(makeSLABar());
    
        checkForCpts();
    }
})(); 


