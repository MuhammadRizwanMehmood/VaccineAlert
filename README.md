# About
This utility can login into Cowin, track vaccine availability and automatically book a a vaccination slot if you are logged in. The app is made possible by #
The deployment is available at

This app also supports #
* Booking for mutliple beneficiaries
* Dose based availability
* Captcha code 
* Paid/Free selection
* Age Group Selection

# API for integrating link based booking into your app/Notifications system
This API allows you to open a URL from within your application where a user will be readily available to book. Support for passing user's token coming soon. Please report an issue if you need this expedited.

### URL Pattern: 
`#`
Where 
 - `dose` is a Number indicating dose1 or dose2. Value 1 indicates dose1 and value 2 indicates dose 2
 - `session_id`is a String and it's the value of the session_id as available from Cowin's availability API
 - `slot` is a String which is the slot list item on the slots Array available from 

#### Example: 

## Running locally
```yarn install```
```yarn start```

## Update poll frequency using
```localStorage.pollFreq = 1000```
This also works on the deployed version.

# Backers

