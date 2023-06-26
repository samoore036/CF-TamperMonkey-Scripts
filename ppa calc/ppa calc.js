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
        loadSubmitButtons();
        loadSettingsButton();
        openModal();
    } else {
        loadSubmitButtons();
        loadTimeDisplayDiv();
        loadSettingsButton();
        loadTableData();
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
        timeDiv.style.cssText += `display: flex; flex-direction: column; gap: 2rem;`
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
            position: relative; bottom: 3rem; left: 38.7rem;
            border: medium none;
            font-size: 1.7rem; width: 2.5rem; height: 2.5rem;
            color: white; background-color: rgb(220, 38, 38);
            cursor: pointer;
        `
        button.textContent = '✖';
        button.addEventListener('click', closeModal);

        return button;
    }

    function loadSubmitButtons() {
        const parent = document.querySelector('.cp-submit-row');
        makeSubmitButtons(parent);
    }

    function loadTimeDisplayDiv() {
        const parent = document.querySelector('.cp-submit-row');
        parent.prepend(makeTimeDisplayDiv());
    }

    function loadSettingsButton() {
        const parent = document.querySelector('.cp-submit-row');
        parent.prepend(makeSettingsBtn());
    }

    function makeTimeDisplayDiv() {
        const div = document.createElement('div');
        div.setAttribute('id', 'time-display-div');
        div.style.cssText += `display: flex; flex-direction: column; justify-content: space-between; gap: 0.5rem;`;

        const dateButtonTray = document.createElement('div');
        dateButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        loadDateButtons(dateButtonTray);

        const timeButtonTray = document.createElement('div');
        timeButtonTray.style.cssText += `display: flex; gap: 0.1rem;`;
        const fullShiftButton = makeTimeButton('Full Shift');
        fullShiftButton.addEventListener('click', () => {
            let endTime;
            // must iterate backwards to find endtime
            for (let i = 5; i > 0; i--) {
                console.log(getUserTimes());
                if (getUserTimes()[`end${i}`]) {
                    endTime = getUserTimes()[`end${i}`];
                    break;
                }
            }
            const startHour = getUserTimes()[`start${1}`].split(':')[0];
            const startMinute = getUserTimes()[`start${1}`].split(':')[1];
            const endHour = endTime.split(':')[0];
            const endMinute = endTime.split(':')[1];
            document.getElementById('startHourIntraday').selectedIndex = startHour;
            document.getElementById('startMinuteIntraday').selectedIndex = getSelectIndexMinute(startMinute);
            document.getElementById('endHourIntraday').selectedIndex = endHour;
            document.getElementById('endMinuteIntraday').selectedIndex = getSelectIndexMinute(endMinute);
            console.log(endTime.split(':')[0]);
            console.log(endTime.split(':')[1]);
        })

        timeButtonTray.appendChild(fullShiftButton);
        loadTimeButtons(timeButtonTray);

        div.appendChild(dateButtonTray);
        div.appendChild(timeButtonTray);

        return div;
    }

    function makeSettingsBtn() {
        const settingsDiv = document.createElement('div');
        settingsDiv.setAttribute('id', 'schedule-settings-button');
        settingsDiv.style.cssText += `align-self: end;`;
        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = 'Change Schedule Settings';
        settingsBtn.type = 'button'; // type necessary to prevent submitting as it is technically in a form
        settingsBtn.addEventListener('click', openModal);
        settingsDiv.appendChild(settingsBtn);

        return settingsDiv;
    }

    // adds submit form buttons that will load the correct displayed info for parsing correctly
    function makeSubmitButtons(submitDiv) {
        submitDiv.prepend(makeSubmitButton('Go to rebin'));
        submitDiv.prepend(makeSubmitButton('Go to pack'));
        submitDiv.prepend(makeSubmitButton('Go to pick'));
    }

    /*************\
    |DOM factories|
    \*************/
    
    function makeTimeInputDiv(number) {
        const div = document.createElement('div');
        div.style.cssText += `display:flex; gap: 2rem;`;

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
        if (getUserTimes()) {
            if (getUserTimes()[`start${number}`]) {
                startInput.value = getUserTimes()[`start${number}`];
            }
        }

        const endDiv = document.createElement('div');
        const endPrompt = document.createElement('div');
        endPrompt.textContent = 'End time:';
        endDiv.appendChild(endPrompt);
        const endInput = document.createElement('input');
        endInput.style.color = 'black';
        endInput.placeholder = 'ex: 09:45';
        endDiv.appendChild(endInput);
        div.appendChild(endDiv);
        if (getUserTimes()) {
            if (getUserTimes()[`end${number}`]) {
                endInput.value = getUserTimes()[`end${number}`];
            }
        }

        return div;
    }

    function makeDateButton(name) {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.cssText += `
            border: 2px solid #2e6da4; background-color: #337ab7; color: white;
            padding: 6px 12px; 
        `
        button.type = 'button';

        const today = new Date();
        const startDate = document.getElementById('startDateIntraday');
        const endDate = document.getElementById('endDateIntraday');
        if (name === 'Today') {
            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();
            button.addEventListener('click', () => {
                startDate.value = `${year}/${month}/${day}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        } else if (name === 'Yesterday') {
            today.setDate(today.getDate() - 1);
            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();
            button.addEventListener('click', () => {
                startDate.value = `${year}/${month}/${day}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterYear = yesterday.getFullYear();
            const yesterMonth = yesterday.getMonth() + 1 < 10 ? `0${yesterday.getMonth() + 1}` : yesterday.getMonth() + 1;
            const yesterDay = yesterday.getDate() < 10 ? `0${yesterday.getDate()}` : yesterday.getDate();

            const year = today.getFullYear();
            const month = today.getMonth() + 1 < 10 ? `0${today.getMonth() + 1}` : today.getMonth() + 1;
            const day = today.getDate() < 10 ? `0${today.getDate()}` : today.getDate();

            button.addEventListener('click', () => {
                startDate.value = `${yesterYear}/${yesterMonth}/${yesterDay}`;
                endDate.value = `${year}/${month}/${day}`;
            })
        }

        return button;
    }

    function makeTimeButton(name, i) {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.cssText += `
            border: 2px solid #2e6da4; background-color: #337ab7; color: white;
            padding: 6px 12px; 
        `
        button.type = 'button';

        if (i) {
            button.addEventListener('click', () => {
                const startHour = getUserTimes()[`start${i}`].split(':')[0];
                const startMinute = getUserTimes()[`start${i}`].split(':')[1];
                const endHour = getUserTimes()[`end${i}`].split(':')[0];
                const endMinute = getUserTimes()[`end${i}`].split(':')[1];
                console.log(getUserTimes()[`start${i}`]);
                console.log(getUserTimes()[`end${i}`]);
                document.getElementById('startHourIntraday').selectedIndex = startHour;
                document.getElementById('startMinuteIntraday').selectedIndex = getSelectIndexMinute(startMinute);
                document.getElementById('endHourIntraday').selectedIndex = endHour;
                document.getElementById('endMinuteIntraday').selectedIndex = getSelectIndexMinute(endMinute);
            })
        }
            
        return button;
    }

    function makeSubmitButton(category) {
        const button = document.createElement('button');
        button.textContent = category;
        button.style.cssText += `
            border: 1px solid #ccc; background-color: white; color: black; font-size: 12px;
            padding: 3px 6px; margin-left: 1em; margin-top: 1rem;
        `
        button.type = 'button';
        if (category.includes('pick')) {
            button.addEventListener('click', goToPick);
        } else if (category.includes('pack')) {
            button.addEventListener('click', goToPack);
        } else if (category.includes('rebin')) {
            button.addEventListener('click', goToRebin);
        }
            
        return button;
    }

    // three buttons: yesterday, today, yesterday to today
    function loadDateButtons(dateButtonTray) {
        const yesterday = makeDateButton('Yesterday');
        dateButtonTray.appendChild(yesterday);

        const today = makeDateButton('Today');
        dateButtonTray.appendChild(today);

        const yesterdayAndToday = makeDateButton('Yesterday to Today');
        dateButtonTray.appendChild(yesterdayAndToday);
    }

    function loadTimeButtons(timeButtonTray) {
        // first determine if periods or quarters by checking fourth time. if this is null, it's periods, otherwise quarters
        let isPeriods = true;
        const userTimes = getUserTimes();
        if (userTimes.start4 && userTimes.end4) {
            isPeriods = false;
        }

        for (let i = 1; i < 6; i++) {
            const title = isPeriods ? 'Period' : 'Quarter';
            const start = userTimes[`start${i}`];
            const end = userTimes[`end${i}`];
            if (start && end) {
                timeButtonTray.appendChild(makeTimeButton(`${title}${i}`, i));
            }
        }
    }

    function getSelectIndexMinute(minutes) {
        switch(minutes) {
            case '15': return 1;
            case '30': return 2;
            case '45': return 3;
            default: return 0;
        }
    }

    /*****************\
    |DOM element logic|
    \*****************/

    function openModal() {
        const modal = document.getElementById('modal');
        modal.style.zIndex = '1000';
        modal.style.position = 'fixed';
        modal.style.top = '20%';
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


        // if on close the display div does not exist, make and attach it, otherwise update it
        if (!document.getElementById('time-display-div')) {
            loadTimeDisplayDiv();
        } else {
            // remove old one and reload new one
            const timeDisplayDiv = document.getElementById('time-display-div');
            timeDisplayDiv.remove();
            loadTimeDisplayDiv();
        }

        // must remove old settings div and reattach either way
        const settingsDiv = document.getElementById('schedule-settings-button');
        settingsDiv.remove();
        loadSettingsButton();
        loadTableData();
    }   

    // save the inputs into local storage with the fc as the key
    function saveModalSettings(e) {
        const parent = e.target.parentElement;
        const inputs = Array.from(parent.querySelectorAll('input'));
        const timeObject = {
            start1: inputs[0].value,
            end1: inputs[1].value,
            start2: inputs[2].value,
            end2: inputs[3].value,
            start3: inputs[4].value,
            end3: inputs[5].value,
            start4: inputs[6].value,
            end4: inputs[7].value,
            start5: inputs[8].value,
            end5: inputs[9].value 
        }

        console.log(timeObject);

        // put the object into storage
        localStorage.setItem(`${fc}`, JSON.stringify(timeObject));
        closeModal();
    }

    function goToPick() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=UNIT_FLOW_TYPE&secondaryAttribute=PICKING_PROCESS_PATH&nodeType=FC&warehouseId=${fc}&processId=100008`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    function goToPack() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=PACK_FLOW&secondaryAttribute=PACK_TYPE&nodeType=FC&warehouseId=${fc}&processId=100054`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    function goToRebin() {
        const urlFirstHalf = `https://fclm-portal.amazon.com/ppa/inspect/process?primaryAttribute=WORK_FLOW&secondaryAttribute=PICKING_PROCESS_PATH&nodeType=FC&warehouseId=${fc}&processId=100053`;
        window.location.assign(`${urlFirstHalf}${getDateUrlEnding()}`);
    }

    // returns the ending date parameter portion for the submit url which is the same for each process
    function getDateUrlEnding() {
        const startDate = document.getElementById('startDateIntraday').value;
        const startDateYear = startDate.split('/')[0];
        const startDateMonth = startDate.split('/')[1];
        const startDateDay = startDate.split('/')[2];
        const startHourIntraday = document.getElementById('startHourIntraday').value;
        const startMinuteIntraday = document.getElementById('startMinuteIntraday').value;
        const endDate = document.getElementById('endDateIntraday').value;
        const endDateYear = endDate.split('/')[0];
        const endDateMonth = endDate.split('/')[1];
        const endDateDay = endDate.split('/')[2];
        const endHourIntraday = document.getElementById('endHourIntraday').value;
        const endMinuteIntraday = document.getElementById('endMinuteIntraday').value;

        return `&startDateDay=2019%2F12%2F20&startDateWeek=2019%2F12%2F20&startDateMonth=2022%2F08%2F01&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${startDateYear}%2F${startDateMonth}%2F${startDateDay}&startHourIntraday=${startHourIntraday}&startMinuteIntraday=${startMinuteIntraday}&endDateIntraday=${endDateYear}%2F${endDateMonth}%2F${endDateDay}&endHourIntraday=${endHourIntraday}&endMinuteIntraday=${endMinuteIntraday}`;
    }

    /***************************\
    |local storage functionality|
    \***************************/

    function getUserTimes() {
        return JSON.parse(localStorage.getItem(`${fc}`));
    }

    /****************\
    |table data logic|
    \****************/
    function loadTableData() {
        const process = document.getElementById('select2-processSelector-container').textContent;
        if (process.includes('Pick')) {
            console.log('load pick table');
        } else if (process.includes('Pack')) {
            console.log('load pack table');
        } else if (process.includes('Rebin')) {
            console.log('load rebin table');
        }
    }
})(); 


