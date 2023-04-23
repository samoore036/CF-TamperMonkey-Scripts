**Purpose:**
As SW increases and with the nature of 2:1, it can be easy to miss a CPT pull. The purpose of this plugin is to automate CPT pulls at the slam pad time.
This is not a replacement of pulls as flow leads should still be aware of how many misses they are looking at for a CPT. 
It is intended as a supplement to support our work as existing tools such as Atlas Alerts are tedious to use and require a lot of filtering.
This plugin will work for **any USNS FC** regardless of what timezone your laptop is set to.
This plugin will not auto-download if your laptop is locked or on sleep mode/turned off.
The .csv's will be sent to wherever your downloads normally go (usually downloads folder) and will only include CE misses.

**Setup:** 
Download the tampermonkey plugin. Click on Cpt Puller.js then click 'Raw' near the top right. Copy and paste this information as a new script in tampermonkey.
In Firefox, go to Settings then scroll down to the Files and Applications settings and make sure "Always ask you where to save files" is **not checked**.

![image](https://user-images.githubusercontent.com/104536361/233859989-25412830-fa29-4881-b911-b0e128a7b0a1.png)

Then go to Privacy & Security, scroll down to Block pop-up windows, click on Exceptions and enter the Rodeo domain: https://outbound-flow-iad.amazon.com
This is necessary to ensure the download is not blocked by the browser manager.

![image](https://user-images.githubusercontent.com/104536361/233860047-6381c23e-c554-4818-b1ea-963d20b4e41e.png)

When Rodeo loads for the first time, you will be prompted to enter the slam pad time for that FC. This information can be found on CORA and is **critical** for this to work.

![image](https://user-images.githubusercontent.com/104536361/233859901-d1679c72-cbbb-4d38-acbd-64ae4533a1c5.png)

If you enter the wrong slam pad time or the slam pad time updates, this can always be changed as pictured below.

![image](https://user-images.githubusercontent.com/104536361/233859921-97d8e1ee-ed3b-4d70-831d-5ac201fd6507.png)

With all of these settings saved, your cpt's will now pull at the slam pad time entered and be sent to your downloads folder. Enjoy!

**How it works**:
The localStorage API is used to check if the user has set a slam pad time for the FC they are currently looking at in Rodeo. If not, the user will be prompted to enter the slam pad time in minutes.
Once this is set, the script begins running.
The script will call the getNextCpt function in intervals of 20 seconds and check if the current time returned aligns with the next cpt.

**Current time:**
Current time is determined by the user's timezone + the slam pad time + any timezone offset. 
This means that the current time will always be in the future to essentially push forward the current time to align to the cpt pull.
This Date object is returned as timeWithSLA in the getNextCpt function.

The user's timezone is fetched from their laptop. All ARNS and TNS site ID's with timezones are listed in the script as well. The script will check for the FC id and look up the corresponding time zone.
If there is a difference in the user's timezone and the FC's timezone, an offset will be created. The formula is FC timezone - user timezone.
PST timezones are 0, AZ is 0, MST is 1, CST is 2, EST is 3.
Example: Your device is set to EST and site is in MST. Timezone offset will be -2 (1 - 3).
An API was not used to fetch FC data as the plugin uses an interval of 20 seconds and current APIs with this data have 700+ sites to parse through.

**Next cpt time:**
Next cpt time is determined by parsing the DOM for the CPT times listed on the top of the first Rodeo table. 
The script will turn these TDs into an array and parse the text content of each one and turn them into a Date object.
The script will then take the current time calculated above and loop through the array until a date is greater than the current time calculation.
This date will be the next cpt to download.

All of this happens in the getNextCpt function which returns four objects: timeWithSLA, nextCpt, and two Date objects.
The two Date objects are offsets needed to access the .csv's link for download. 
These offsets are represented in UTC time down to the hundredth of a millisecond before the actual slam pad time and one minute exactly after the slam pad time.

**Checking against current time:**
Once all of these values are calculated in getNextCpt, the script will check these values to determine if the current time calculation is equal to the next cpt Date object.
Both of these date objects are set down to the minute, not the second, in order to ensure that the two will be able to align. 
In the nature of the work, the data that is pulled does not need to be pulled at exactly the turn of the minute, only within that minute.

If the two dates above are equal, the script will fetch the link created that downloads the .csv, turns it into a blob, and edits that blob for a custom download file name.
This is necessary to do as these files can add up to 20 in a 10-hour shift and the default download name is "shipmentlist1". 
The blob turns the download file name into: (fcName) (cptTime) (cptDate) for ease of use by our flow leads.
Once this has been downloaded, setTimeout will be called for one minute to ensure that the script does not continuously pick up the same cpt after a download.

A boolean flag is also used to prevent setInterval from downloading the file multiple times.

