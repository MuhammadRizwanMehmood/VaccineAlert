
import "./App.css";

import { Button, Col, Input, Row, Radio, Select, Checkbox, Tabs, Modal, Typography, notification, DatePicker } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import React from "react";
import Rollbar from "rollbar";
import CowinApi from "./models";

import PayTMQR from './OfflineMerchant.png'

import parseHTML from 'html-react-parser';
import privacy from './privacy';
import GitHubButton from 'react-github-btn';

import moment from "moment";
import {
  FacebookShareButton,
  WhatsappShareButton,
  TwitterShareButton,
  LinkedinShareButton,
  TelegramShareButton,
  RedditShareButton,
  FacebookIcon,
  LinkedinIcon,
  WhatsappIcon,
  TwitterIcon,
  RedditIcon,
  TelegramIcon

} from "react-share"


const { Text } = Typography;
const { TabPane } = Tabs;
const cowinApi = new CowinApi();
const { Search } = Input;
const { Option } = Select;       


const promosg = {
  text: 'Use this link to track vaccine availability and automatically book a slot for a set of beneficiaries. The app will automatically send OTPs and speak out to tell you to enter security code at the time of booking. ',
  title: 'Automated vaccine booking and availability tracking',
  tags: ['covid19vaccines', 'covid19help', 'vaccination2021', 'covid19india'],
  url: window.location.href.indexOf('localhost') ? '#' : window.location.href
}

const metas = document.getElementsByTagName("meta");
const version = metas[metas.length-1].getAttribute("build-version");

const rollbar= new Rollbar({
  accessToken: '6cc1584388304eed9bf3a32008956052', //d
  captureUncaught: true,
  captureUnhandledRejections: true,
});

const filterSession = (s, state) => {
  let { dose, vaccineType, minAge, feeType } = state;
  let requiredNums = state.selectedBeneficiaries.length
    ? state.selectedBeneficiaries.length
    : 1;

  if (s.available_capacity < requiredNums) {
    return false;
  }
  if (parseInt(s.min_age_limit) !== minAge) {
    return false;
  }
  if (feeType !== "ANY" && feeType !== s.fee_type) {
    return false;
  }
  if (vaccineType !== "ANY" && vaccineType !== s.vaccine) {
    return false;
  }
  if (
    parseInt(dose) === 1 &&
    parseInt(s.available_capacity_dose1) < requiredNums
  ) {
    return false;
  }
  if (
    parseInt(dose) === 2 &&
    parseInt(s.available_capacity_dose2) < requiredNums
  ) {
    return false;
  }
  if (
    parseInt(dose) === 3 &&
    parseInt(s.available_capacity_dose3) < requiredNums
  ) {
    return false;
  }

  return true;
};
class App extends React.Component{
  constructor(props) {
    super(props);
    this.bookingIntervals=[];
    setInterval(() => {
      this.bookingIntervals.map(b=>{
        clearInterval(b)
      })
    }, 1000);
    let state = {
      urlData: null,
      date:
        moment().hour() > 18
          ? moment().add(1, "d").format("DD-MM-YYYY")
          : moment().format("DD-MM-YYYY"),
      isWatchingAvailability: false,
      vaccineType: "ANY",
      bookingInProgress: false,
      isAuthenticated: localStorage.token ? true : false,
      minAge: 15,
      districtId: null,
      stateId: null,
      beneficiaries: [],
      selectedBeneficiaries: [],
      otpData: {
        txnId: null,
      },
      vaccineCalendar: {},
      vaccineSessions: null,
      sessionBasedTracking: true,
      zip: null,
      enableOtp: false,
      otp: null,
      mobile: null,
      feeType: "ANY",
      token: localStorage.token || null,
      selectedTab: "1",
      dates: [],
      states: [],
      dose: 1,
      districs: [],
      session: null,
      showCaptcha: false, //change to false
      captcha: null, //change to null
      bookingCaptcha: null,
      bookingCenter: null,
      showSuccessModal: false,
    };
    if(localStorage.appData){
      try {
        state = Object.assign(state, JSON.parse(localStorage.appData))  
      } catch (error) {

      }
      
      state.date = moment().hour() > 18
      ? moment().add(1, "d").format("DD-MM-YYYY")
      : moment().format("DD-MM-YYYY");
    } 
    if(localStorage.token){
      state.token = localStorage.token;
      state.isAuthenticated = true;
      state.enableOtp = false;
    }
    
    this.state = state;
  }
  getBeneficiaries(){
    cowinApi.getBenefeciaries(this.state.token).then(data=>{
      this.setState({beneficiaries: data},()=>{
        this.setStorage();
        if(this.state.urlData){
          if(this.state.isAuthenticated){
            this.getCaptcha()
          }else if(this.state.mobile){
            this.generateOtp()
          }else{
            this.speak("Please login")
          }
        }
      });
    }).catch(err=>{
      console.log('err bens', err);
      delete localStorage.token;
      this.setState({isAuthenticated: false, token: null, enableOtp: false},()=>{
        if(this.state.mobile){

          if(this.state.urlData){
            this.getQueryObj();
          }
        }
      })
    })
  }
  speak(msg){
    try {
      let speech = new SpeechSynthesisUtterance();
      speech.lang = "en-UK";
      speech.volume = 1;
      speech.rate = 1;
      speech.pitch = 1; 
      speech.text = msg;
      window.speechSynthesis.speak(speech);  
    } catch (error) {
      console.log(error);
    }
      
  }
  getQueryObj(){
    let search = window.location.search.substring(1);
    if(search.length===0) return;
    let urlData = JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) })

    if(urlData.session_id && urlData.dose && urlData.slot){
      this.setState({urlData, dose: parseInt(urlData.dose)},()=>{        
        
      })
    }
  }
  sendNotification(title, msg){
    let opts = {
      title: title,
      body: msg,
      native: true,
      vibrate: [300, 100, 400]
    };
    try {
      new Notification(opts.title, opts);    
    } catch (error) {
      console.log(error);
    }
    
  }
  componentDidMount(){
   
    this.notifSound = document.getElementById("notif");
    let token = localStorage.token || this.state.token;
    if(token){
      this.getBeneficiaries();
      this.trackAuth(token);
    }

    cowinApi.getStates().then(data=>{
      this.setState({states: data.states},()=>{
        this.selectState(this.state.stateId);
        this.selectDistrict(this.state.districtId);
      })
    }).catch(err=>{
      console.log(err);
    })
    

    try {
      Notification.requestPermission((status) => {

      });  
    } catch (error) {
      console.log(error);
    }  
    try {

    } catch (error) {
      console.log(error)
    }
      let opts = {
        title: "Vaccine Notifications Enabled",
        body: `You now have notifications active for Covid vaccine availability`,
        native: true,
        vibrate: [300, 100, 400]
      };
      try {
        Notification.requestPermission(function(result) {

          if (result === 'granted' && navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(function(registration) {

              registration.showNotification(opts.title, opts);
            });
          }
        });
        new Notification(opts.title, opts);  
      } catch (error) {
        console.log(error);
      }

      try {
        this.getQueryObj();  
      } catch (error) {
        console.log(error);
      }
  }
  setStorage(){
    let state;
    try {
      state = Object.assign({}, this.state)
    } catch (error) {
      state = this.state;
    }
    
    delete state.enableOtp;
    delete state.appointment_id;
    delete state.vaccineCalendar;
    delete state.vaccineSessions;
    delete state.isWatchingAvailability;
    delete state.urlData;
    delete state.captcha;
    delete state.bookingCaptcha;
    localStorage.appData = JSON.stringify(state);
  }
  componentWillUnmount() {

    this.setStorage();
    if(this.watcher) this.watcher.unsubscribe();
  }
  handleNotification(){
    if(!this.state.isWatchingAvailability){
      return;
    }
    let centers = this.state.vaccineCalendar.centers;
    let bkgInProgress = false;
    if(!Array.isArray(centers)) return;
    centers.map(c=>{
      c.sessions.map(s=>{
        if(!filterSession(s, this.state)){
          return;
        }
        
        if (
          !this.state.bookingInProgress
        ) {
  
          let opts = {
            title: c.name,
            body: `${c.pincode} ${c.address} has ${s.available_capacity} on ${s.date}`,
            vibrate: [300, 100, 400],
            native: true,
          };
          try {
            Notification.requestPermission(function (result) {
              if (result === "granted" && navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(function (registration) {
                  registration.showNotification(opts.message, opts);
                });
              }
            });
            new Notification(opts.title, opts);
          } catch (error) {
            console.log(error);
          }
          this.speak(`Vaccines available at ${c.name}`);
          
          if (this.state.isAuthenticated) {
            this.setState(
              { bookingInProgress: true, bookingCenter: c, bookingSession: s },
              () => {
                if (!this.state.bookingCaptcha && !bkgInProgress) {

                  bkgInProgress = true;
                  this.clearWatch();
                  this.book(s, c);
                }
              }
            );
          } else {
            this.speak('Login to book');
          }
        }
      })
    })
  }
  bookingError = (msg, desc) => {
    notification.error({
      message: msg,
      description: desc
    });
  };
  getCaptcha(){
    if(window.speechSynthesis){
      window.speechSynthesis.cancel()
    }
    this.setState({bookingInProgress: true}, ()=>{
      cowinApi.getCaptcha().then(data=>{
        if(this.state.urlData){
          this.speak('Please select beneficiaries');
        }
        let centerName;
        if(this.state.bookingCenter){
          centerName = this.state.bookingCenter.name
        }else if(this.state.bookingSession && this.state.bookingSession.name){
          centerName = this.state.bookingSession.name
        }
        this.speak(`Enter captcha to proceed with booking. Dose ${this.state.dose} vaccines available  ${centerName ? 'at '+centerName : ''}`)
        this.setState({captcha: data.captcha, showCaptcha: true},()=>{
        })
      }).catch(err=>{
        console.log('error getting captcha ',err)
        this.setState({bookingInProgress: false, urlData: null})
      })
    })
  }
  async book(captcha){
    if(window.speechSynthesis){
      window.speechSynthesis.cancel()
    }
    
    let benIds = [];
    let session = this.state.bookingSession;
    if(this.state.selectedBeneficiaries.length === 0){
      if(!this.state.isAuthenticated){
        this.setState({enableOtp: true},()=>{
          this.generateOtp()
        })
      }
      return;
    }else{
      this.state.selectedBeneficiaries.map(sb=>{
        benIds.push(sb.beneficiary_reference_id)
      })
    }
    
    let urlData = this.state.urlData;
    let dose = this.state.dose || 1;
    let session_id = urlData ? urlData.session_id : session.session_id;
    let slot = urlData ? urlData.slot.session : session.slots[Math.floor(Math.random() * session.slots.length)];
    let payload = {
      dose,
      session_id,
      slot,
      beneficiaries: benIds,
      captcha: this.state.bookingCaptcha
    }

      cowinApi.book(payload, this.state.token).then(data=>{
        console.log('Booking success ', data.appointment_id);
        this.speak("Booking Success");
        this.clearWatch();
        this.setState({bookingInProgress: false, appointment_id: JSON.stringify(data), showSuccessModal: true});

        let names = '';
        let location = '';
        
        try {
          if(this.state.bookingCenter){
            location = this.state.bookingCenter.district_name
          }
          if(this.state.bookingSession && this.state.bookingSession.district_name){
            location = this.state.bookingSession.district_name;
          }
          let benName = []
          this.state.selectedBeneficiaries.map((s) => {
            let maskedName = s.name.split(" ")[0].substring(0, 5) + '***' 
            names = names + maskedName;
            benName.push(maskedName);
          });


          let centerName = '';
          if(this.state.bookingSession && this.state.bookingSession.name){
            // let s = this.state.bookingSession
            centerName = this.state.bookingSession.name;
          }
          if(this.state.bookingCenter){
            centerName = this.state.bookingCenter.name
          }

          if(location !== ''){
    
            rollbar.info(
              "booking_success " +
                names +
                " | Count -" +
                this.state.selectedBeneficiaries.length +
                "| Location - " +
                location +
                "| b-" +
                version
            );
          }
          
        } catch (error) {
          console.log(error);
        }
      }).catch(err=>{
        this.setState({
          bookingInProgress: false, 
          urlData: null,
          session: null, 
          bookingCenter: null, 
          captcha: null, 
          bookingSession: null, 
          bookingCaptcha: null, 
          showCaptcha: false
        });
        let msg = 'Booking did not get through. ';
        console.log(err);
        let desc = err.error || "The availability probably ran out before you could take an action. The app will continue to look for slots."
        this.bookingError(msg, desc);
        if(this.state.districtId || this.state.zip){
          this.initWatch();
        }
        window.history.pushState(null, "", window.location.href.split("?")[0]);

        let errors = [];
        if(localStorage.errors){
          errors = JSON.parse(localStorage.errors);
        }

        let errorRecorded = false;
        errors.map(e=>{
          if(err.error === e.error){
            errorRecorded = true;
          }
        })
        if(errorRecorded === false){
          errors.push(err);
          localStorage.errors = JSON.stringify(errors);

  }
  handleNotificationS(){
    if(!this.state.isWatchingAvailability){
      return;
    }
    let sessions = this.state.vaccineSessions;
    
    let bkgInProgress = false;
    if(!Array.isArray(sessions.sessions)) return;
      sessions.sessions.map(s=>{
        if(!filterSession(s, this.state)){
          return null;
        }
        if (
          !this.state.bookingInProgress
        ) {
          

          let opts = {
            title: s.name,
            body: `${s.name} ${s.address} has ${s.available_capacity} on ${s.date}`,
            vibrate: [300, 100, 400],
            native: true,
          };
          try {
            Notification.requestPermission(function (result) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(function (registration) {
                  registration.showNotification(opts.message, opts);
                });
              }
            });
            new Notification(opts.title, opts);
          } catch (error) {
            console.log(error);
          }
          this.speak(`Vaccines available at ${s.name}`);
          try {
            if(window.ga){
              window.ga('send', 'event', {
                eventCategory: 'availability',
                eventAction: 'success'
              });
            }
          } catch (error) {
            
          }
          if (this.state.isAuthenticated) {
            this.setState(
              { bookingInProgress: true, bookingSession: s },
              () => {
                if (!this.state.bookingCaptcha && !bkgInProgress) {
                 
                  bkgInProgress = true;
                  this.clearWatch();
                  this.book(s);
                }
              }
            );
          } else {
            this.speak('Login to book');
          }
        }
      })
  }
  initDistS(){
    const self = this;
    this.setStorage();
    this.setState({isWatchingAvailability: true});
    this.watcher = cowinApi
      .initDistS(this.state.districtId, this.state.date)
      .subscribe({
        next(data) {
          self.setState({vaccineSessions: data},()=>{
            self.handleNotificationS();
          })
        },
        error(err) {
          console.error("something wrong occurred: " + err);
        },
        complete() {
        
          this.setState({ isWatchingAvailability: false });
        },
      });
  }

  initWatch(zip) {
    const self = this;

    this.setStorage();
    this.setState({isWatchingAvailability: true});
    if(this.state.sessionBasedTracking){
     

      if(this.state.selectedTab === "1"){
        this.watcher = cowinApi
          .initDistS(this.state.districtId, this.state.date)
          .subscribe({
            next(data) {
              self.setState({ vaccineSessions: data }, () => {
                self.handleNotificationS();
              });
            },
            error(err) {
              console.error("something wrong occurred: " + err);
            },
            complete() {
           
              this.setState({ isWatchingAvailability: false });
            },
          });
      }else{
        this.watcher = cowinApi
          .initS(this.state.zip, this.state.date)
          .subscribe({
            next(data) {
              self.setState({ vaccineSessions: data }, () => {
                self.handleNotificationS();
              });
            },
            error(err) {
              console.error("something wrong occurred: " + err);
            },
            complete() {
          
              this.setState({ isWatchingAvailability: false });
            },
          });
      }
    }else{
      if(this.state.selectedTab === "1"){
        this.watcher = cowinApi
        .initDist(this.state.districtId, this.state.date)
        .subscribe({
          next(data) {
            self.setState({vaccineCalendar: data},()=>{
              self.handleNotification();
           
            })
          },
          error(err) {
            console.error("something wrong occurred: " + err);
          },
          complete() {
           
            this.setState({ isWatchingAvailability: false });
          },
        });
      }else{
        this.watcher = cowinApi
          .init(this.state.zip, this.state.date)
          .subscribe({
            next(data) {
              self.setState({ vaccineCalendar: data }, () => {
                self.handleNotification();
                self.setStorage();
              });
            },
            error(err) {
              console.error("something wrong occurred: " + err);
            },
            complete() {
              console.log("done");
              this.setState({ isWatchingAvailability: false });
            },
          });
      }
    }
    
    
  }
  trackAuth() {
    const self = this;
    if(this.state.isAuthenticated===false) return;
    this.authWatch = cowinApi
      .trackAuth(this.state.token)
      .subscribe({
        next(data) {
    
          if(Array.isArray(data)){
            self.setState({beneficiaries: data})
          }else{
            cowinApi.clearAuthWatch();
            delete localStorage.token;
            self.setState({isAuthenticated: false, token: null},()=>{
              if(self.state.isWatchingAvailability){
                self.clearWatch();
                self.initWatch();
                self.generateOtp();
                self.sendNotification('Session expired', 'Session expired, please login')
              }
              self.speak("Session expired!");
            })
          }
          
        },
        error(err) {
      
          self.speak('Session expired!');
          cowinApi.clearAuthWatch();
          delete localStorage.token;
          self.setState({isAuthenticated: false, token: null},()=>{
            if(self.state.isWatchingAvailability && !self.state.enableOtp){
              self.generateOtp();
              
              self.speak('Session expired!');
            }
          })
        },
        complete() {
          self.setState({ isWatchingAvailability: false });
        },
      });
  }
  clearWatch() {
    if(window.speechSynthesis){
      window.speechSynthesis.cancel();
    }
    cowinApi.clearWatch();
    this.setState({ isWatchingAvailability: false });
  }
  
  renderTable(){
    let vaccineCalendar = this.state.vaccineCalendar;
    if(!vaccineCalendar.centers){
      return;
    }
    return (
      <div style={{maxWidth: "100%", overflow: 'scroll'}}>
        <h2 style={{ marginTop: 10 }}>Vaccination Centers & Availability Info - {this.state.date}</h2>
        <Text type="secondary">You will see all kinds of availability below. But, the notifications and bookings will be done for your selected preferences only.</Text>
        <table className="table" style={{ marginTop: 10 }}>
          <tbody>
          {vaccineCalendar.centers.map((vc) => {
            let noAvailability = true;
            vc.sessions.map((ss) => {
              if (ss.available_capacity > 0) noAvailability = false;
            });

            return (
              <tr key={vc.center_id}>
                <td>
                  <h3>{vc.name}</h3>
                  <b>Fee: {vc.fee_type}</b><br/>
                  {vc.block_name}, {vc.address}, {vc.pincode}.
                </td>

                {false ? (
                  <td>No Availability</td>
                ) : (
                  vc.sessions.map((s, i) => {
                    return (
                      <td key={s.session_id}>
                        <h4>{s.date}</h4>
                        <p>{s.vaccine}</p>
                        <div>
                          {parseInt(s.available_capacity) > 0
                            ? `${s.available_capacity} shots available for ${s.min_age_limit}+`
                            : `No Availability ${s.min_age_limit}+`}
                            <br/>
                            Dose1 - {s.available_capacity_dose1 || 0} <br/>
                            Dose2 - {s.available_capacity_dose2 || 0} <br/>
                            Dose3(Precautionary) - {s.available_capacity_dose3 || 0}
                        </div>
                        {parseInt(s.available_capacity > 0) ? (
                          <div>
                            <b>Available Slots</b>
                            {s.slots.map((sl) => {
                              return <Row>{sl}</Row>;
                            })}
                          </div>
                        ) : null}
                      </td>
                    );
                  })
                )}

                {/* </th> */}
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    );
      
  }
  renderSessionTable(){
    if(!this.state.vaccineSessions){
      return;
    }
    let sessions = this.state.vaccineSessions.sessions;
    let anyAvailatility = false;
    anyAvailatility = true;
    return (
      <div style={{ maxWidth: "100%", overflow: "scroll" }}>
        <h2 style={{ marginTop: 10 }}>
          Vaccination Centers & Availability Info - {this.state.date}
        </h2>
        <Text type="secondary">
          You will see all kinds of availability below. But, the notifications
          and bookings will be done for your selected preferences only.
        </Text>
        <table className="table" style={{ marginTop: 10 }}>
          <tbody>
            {anyAvailatility ? (
              sessions.map((s) => {
                return (
                  <td key={s.session_id}>
                    <h3>{s.name}</h3>
                    <b>
                      Fee: {s.fee_type} - {s.fee}
                    </b>
                    <br />
                    {s.block_name}, {s.address}, {s.pincode}.<p>{s.vaccine}</p>
                    <div>
                      {parseInt(s.available_capacity) > 0
                        ? `${s.available_capacity} shots available for ${s.min_age_limit}+`
                        : `No Availability ${s.min_age_limit}+`}
                      <br />
                      Dose1 - {s.available_capacity_dose1 || 0} <br />
                      Dose2 - {s.available_capacity_dose2 || 0} <br />
                      Dose3(Precautionary) - {s.available_capacity_dose3 || 0}
                    </div>
                    {parseInt(s.available_capacity > 0) ? (
                      <div>
                        <b>Available Slots</b>
                        {s.slots.map((sl) => {
                          return <Row>{sl}</Row>;
                        })}
                      </div>
                    ) : null}
                  </td>
                );
              })
            ) : (
              <tr>
                <td>
                  No vaccines avavilabile matching your preferences. Please keep
                  the tracking on to auto detect availability and book if your
                  login is active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
      
  }
  setMinAge(e){
    this.setState({minAge: e.target.value});
  }
  generateOtp(){
    
    this.setState({enableOtp: true}, ()=>{
      cowinApi.generateOtp(this.state.mobile).then(data=>{
        this.speak("One Time Password has been sent to your phone. Please enter to login");
        this.setState({otpData: data, enableOtp: true});
      }).catch(err=>{
        console.log(err);
        this.setState({enableOtp: false})
      })
    });
    
  }
  verifyOtp(){
    cowinApi.verifyOtp(this.state.otp, this.state.otpData.txnId).then(data=>{
      localStorage.token = data.token;
      this.setState({token: data.token, isAuthenticated: true, enableOtp: false}, ()=>{
        this.setStorage();
        this.getBeneficiaries();
        this.trackAuth(data.token);
        if(this.state.isWatchingAvailability){
          this.clearWatch();
          this.initWatch();
        }
        if(this.state.selectedBeneficiaries.length===0){
          this.clearWatch();
        }
        if(this.state.urlData){
          this.getQueryObj();
        }
        
      })
    }).catch(err=>{
      console.log(err);
      if(this.state.isAuthenticated){
        delete localStorage.appData;
        delete localStorage.token;
        this.setState({token: null, isAuthenticated: false});
      }
    })
  }
  selectState(stateId){
    this.setState({stateId}, ()=>{
      cowinApi.getDistricts(stateId).then(data=>{
        this.setState({districs: data});
      }).catch(err=>{
        console.log(err)
      })
    })
  }
  selectDistrict(districtId){
    this.setState({districtId}, ()=>{
    })
  }
  renderCaptcha(){
    if(!this.state.captcha) return;
    let centerName;
    if(this.state.bookingCenter){
      centerName = this.state.bookingCenter.name
    }else if(this.state.bookingSession && this.state.bookingSession.name){
      centerName = this.state.bookingSession.name;
    }
    return (
      <div>
        <h2 style={{ marginTop: 10, marginBottom: 0 }}>Enter Captcha to book at {centerName}</h2>
        <Row>
          <Col>{parseHTML(this.state.captcha)}</Col>
          <Search
            placeholder="Enter Captcha"
            allowClear
            autoFocus={true}
            style={{width: 300, marginTop: 10}}
            enterButton={"Submit & Book"}
            size="large"
            onSearch={(e) => {
              console.log(e);
              this.setState({ bookingCaptcha: e }, () => {
                this.book();
              });
            }}
          />
          
        </Row>
      </div>
    );
  }
  renderModal(){
    let center = {
      name: null,
      address: null
    }
    if(this.state.bookingSession && this.state.bookingSession.name){
      let s = this.state.bookingSession
      center.name = this.state.bookingSession.name;
      center.address = `${s.block_name}, ${s.address}, ${s.pincode}.`;
    }
    if(this.state.bookingCenter){
      let c = this.state.bookingCenter;
      center.name = this.state.bookingCenter.name
      center.address = `${c.block_name}, ${c.address}, ${c.pincode}.`;
    }
    if(!center.name){
      return;
    }
    return <Modal
        mask={true}
        maskClosable={false}
        title="Congrats!"
        visible={this.state.showSuccessModal}
        onOk={(e) => {
          this.setState({showSuccessModal: false}, ()=>{
            this.messagesEnd.scrollIntoView({ behavior: "smooth" });
          })
          
        }}
        onCancel={(e) => {
          this.messagesEnd.scrollIntoView({ behavior: "smooth" });
          this.setState({
            bookingInProgress: false, 
            urlData: null,
            showSuccessModal: false, 
            bookingCenter: null, 
            bookingSession: null, 
            captcha: null, 
            bookingCaptcha: null,
            showCaptcha: false
          });
        }}
      >
        <p>
          Your vaccination slot is booked for selected beneficiaries at{" "}
          {center.name}, {center.address}
        </p>
        <p>Your appointment id is {this.state.appointment_id}</p>
        <p>
          You can login into{" "}
          <a
            href="https://www.cowin.gov.in/"
            target="_blank"
            rel="noreferrer"
          >
            Cowin
          </a>{" "}
          to see details of your vaccincation slot.
        </p>
        <h2>If you have liked using this app, please consider donating and sharing a word around. You can find these options at the bottom of the page.</h2>
      </Modal>;
    
  }
  renderShare(){
    return (
      <div>
        <FacebookShareButton
          url={promosg.url}
          quote={promosg.text}
          hashtag={promosg.tags[0]}
          className="Demo__some-network__share-button"
        >
          <FacebookIcon size={48} round />
        </FacebookShareButton>
        <TwitterShareButton
          url={promosg.url}
          title={promosg.title}
          className="Demo__some-network__share-button"
        >
          <TwitterIcon size={48} round />
        </TwitterShareButton>
        <WhatsappShareButton
          url={promosg.url}
          title={promosg.text}
          separator=":: "
          className="Demo__some-network__share-button"
        >
          <WhatsappIcon size={48} round />
        </WhatsappShareButton>
        <LinkedinShareButton
          url={promosg.url}
          summary={promosg.text}
          className="Demo__some-network__share-button"
        >
          <LinkedinIcon size={48} round />
        </LinkedinShareButton>
        <RedditShareButton
          url={promosg.url}
          title={promosg.text}
          windowWidth={660}
          windowHeight={460}
          className="Demo__some-network__share-button"
        >
          <RedditIcon size={48} round />
        </RedditShareButton>

        <TelegramShareButton
          url={promosg.url}
          title={promosg.text}
          className="Demo__some-network__share-button"
        >
          <TelegramIcon size={48} round />
        </TelegramShareButton>
      </div>
    );
  }
  renderPayTMQR(){
    return (
      <Modal
        visible={this.state.showPayTMQR}
        title="PayTM ALL-IN-ONE QR"
        okText="Close"
        onCancel={e=>{this.setState({showPayTMQR: false})}}
        footer={[
          <Button
            key="back"
            onClick={(e) => {
              this.setState({ showPayTMQR: false });
            }}
          >
            Okay
          </Button>,
        ]}
      >
        <div style={{ width: "100%", textAlign: "center" }}>
          <img style={{ width: 300 }} src={PayTMQR} alt="PayTM QR Code" />
        </div>
      </Modal>
    );
  }
  renderDonate(){
    return (
      <div>
        <h2 style={{ marginTop: 15, marginBottom: 0 }}>Sponsor/Donate</h2>
        <p>
          It all started out as an experiment and the response has been great
          and I'd like to continue supporting this. If you've liked using this
          app, please consider donating using one of the options below.
        </p>
        <div>
          {/* <form id="donateForm"></form> */}
          <img style={{ width: 300 }} src={PayTMQR} alt="PayTM QR Code" />
          
        </div>
      </div>
    );
  }
  renderTrackingSelection(){
    if(this.state.urlData){
      return;
    }
    return <div>
      <h2 style={{ marginTop: 15, marginBottom: 0 }}>
              Select Location for Vaccination
            </h2>
            <Tabs
              defaultActiveKey={this.state.selectedTab || "1"}
              onChange={(e) => {
                this.setState({ selectedTab: e });
              }}
            >
              <TabPane tab="Track By District" key={1}>
                <Select
                  style={{ width: 234 }}
                  size="large"
                  defaultValue={this.state.stateId}
                  disabled={this.state.isWatchingAvailability}
                  onChange={this.selectState.bind(this)}
                  placeholder="Select State"
                >
                  {this.state.states.map((s) => {
                    return (
                      <Option key={s.state_id} value={s.state_id}>
                        {s.state_name}
                      </Option>
                    );
                  })}
                </Select>

                <Select
                  style={{ width: 234 }}
                  defaultValue={this.state.districtId}
                  disabled={this.state.isWatchingAvailability}
                  size="large"
                  onChange={(val) => {
                    this.selectDistrict(val);
                  }}
                  placeholder="Select District"
                >
                  {this.state.districs.map((d) => {
                    return (
                      <Option key={d.district_id} value={d.district_id}>
                        {d.district_name}
                      </Option>
                    );
                  })}
                </Select>
                <Button
                  type="primary"
                  size="large"
                  loading={this.state.isWatchingAvailability}
                  onClick={(e) => this.initWatch()}
                >
                  {this.state.isWatchingAvailability
                    ? "Tracking"
                    : this.state.isAuthenticated
                    ? "Track Availability & Auto-Book for selected preferences"
                    : "Track Availability"}
                </Button>
                {this.state.isWatchingAvailability ? (
                  <Button
                    type="primary"
                    icon={<CloseCircleOutlined />}
                    size={"large"}
                    danger
                    onClick={this.clearWatch.bind(this)}
                  >
                    Stop
                  </Button>
                ) : null}
              </TabPane>
              <TabPane tab="Track By Pincode" key={2}>
                <Row>
                  <Search
                    disabled={this.state.isWatchingAvailability}
                    placeholder={
                      this.state.zip
                        ? this.state.zip
                        : "Enter your area pincode"
                    }
                    allowClear
                    defaultValue={this.state.zip || null}
                    type="number"
                    // value={this.state.zip}
                    enterButton={
                      this.state.isWatchingAvailability
                        ? `Tracking`
                        : this.state.isAuthenticated
                        ? "Track Availability & Auto-Book for selected preferences"
                        : "Track Availability"
                    }
                    size="large"
                    loading={this.state.isWatchingAvailability}
                    onSearch={(txt) => {
                      this.setState(
                        { zip: txt, isWatchingAvailability: true },
                        () => {
                          this.initWatch();
                        }
                      );
                    }}
                  />
                  {this.state.isWatchingAvailability ? (
                    <Button
                      type="primary"
                      icon={<CloseCircleOutlined />}
                      size={"large"}
                      danger
                      onClick={this.clearWatch.bind(this)}
                    >
                      Stop
                    </Button>
                  ) : null}
                </Row>
              </TabPane>
            </Tabs>
    </div>
  }
  renderBookingPreferences(){
    if(this.state.urlData) return;
    return (
      <div>
        <h2 style={{  marginBottom: 0 }}>Vaccination Preferences</h2>
        <Row style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 5, marginBottom: 0 }}>Vaccine Type</h3>
          <Radio.Group
            style={{ marginTop: 7, marginLeft: 10 }}
            onChange={(e) => {
              this.setState({ vaccineType: e.target.value });
            }}
            value={this.state.vaccineType}
            disabled={this.state.isWatchingAvailability}
          >
            <Radio value={"ANY"}>Any</Radio>
            <Radio value={"COVAXIN"}>Covaxin</Radio>
            <Radio value={"COVISHIELD"}>Covishield</Radio>
            <Radio value={"SPUTNIK V"}>Sputnik V</Radio>
            

          </Radio.Group>
        </Row>

        <Row style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 10, marginBottom: 0 }}>Age Group</h3>
          <Radio.Group
            style={{ marginTop: 12, marginLeft: 10 }}
            onChange={this.setMinAge.bind(this)}
            value={this.state.minAge}
            disabled={this.state.isWatchingAvailability}
          >
            <Radio value={15}>15 to 18 Years</Radio>
            <Radio value={18}>18 to 45 Years</Radio>
            <Radio value={45}>45+ Years</Radio>
          </Radio.Group>
        </Row>

        <Row style={{ marginTop: 10 }}>
          <h3 style={{ marginTop: 10, marginBottom: 0 }}>Fee Type</h3>
          <Radio.Group
            style={{ marginTop: 12, marginLeft: 10 }}
            onChange={(e) => {
              this.setState({ feeType: e.target.value });
            }}
            value={this.state.feeType}
            disabled={this.state.isWatchingAvailability}
          >
            <Radio value={"ANY"}>Any</Radio>
            <Radio value={"Free"}>Free</Radio>
            <Radio value={"Paid"}>Paid</Radio>
          </Radio.Group>
        </Row>

        <Row style={{ marginTop: 5 }}>
          <h3 style={{ marginTop: 10, marginBottom: 0 }}>Dose</h3>
          <Radio.Group
            style={{ marginTop: 12, marginLeft: 10 }}
            onChange={(e) => {
              this.setState({ dose: e.target.value });
            }}
            defaultValue={1}
            value={this.state.dose}
            disabled={this.state.isWatchingAvailability}
          >
            <Radio value={1}>Dose 1</Radio>
            <Radio value={2}>Dose 2</Radio>
            <Radio value={3}>Precautionary Dose</Radio>
          </Radio.Group>
        </Row>
        <Row style={{ marginTop: 5 }}>
          <h3 style={{ marginTop: 10, marginBottom: 0 }}>Date</h3>
          <DatePicker disabled={this.state.isWatchingAvailability} defaultValue={moment().hour()>18 ? moment().add(1, 'd') : moment()} disabledDate={(current) =>{
            return current < moment().startOf('day');
          }} style={{marginLeft: 10}} onChange={e=>{
            if(e && e.format){
              this.setState({date: e.format("DD-MM-YYYY")});
            }
            
          }} />
        </Row>
      </div>
    );
  }
  render() 
    const isAuthenticated = this.state.isAuthenticated;
    var {beneficiaries, selectedBeneficiaries} = this.state;
   //   beneficiaries = [];
    // }
    return (
      <div className="App">
        <audio id="notif">
          <source src="https://assets.coderrocketfuel.com/pomodoro-times-up.mp3"></source>
        </audio>
        <header className="App-header">
          <h1>
            Covid-19 automatic vaccine bookings and availability tracking in
            India
          </h1>
          <p>
            This web-app can continously track for availability of vaccine and
            proceed with booking on your behalf if you are logged in. <br />
          </p>
          <p style={{ color: "#555" }}>
            Please register on{" "}
            <a
              href="https://www.cowin.gov.in/"
              target="_blank"
              rel="noreferrer"
            >
              Cowin
            </a>
            {", "}
            add beneficiaries and then, come back here for automated bookings.
            <br />
            For automatic bookings, login, select beneficiaries, keep feeding in
            OTPs every few mins. When there's availability, the app will
            automatically attempt for a booking based on your preferences. When
            there's availability, you will have to enter captcha code if it is
            required. The app will speak out for ANY inputs(OTP and Captcha)
            required. For more information, please see the{" "}
            <a
              href="https://github.com/yashwanthm/cowin-vaccine-booking/wiki/Usage-Guide"
              target="_blank"
              rel="noreferrer"
            >
              Help/Usage Guide
            </a>
            <br />
          </p>
          <b style={{ color: "#555" }}>Important things to note:</b>
          <ol style={{ color: "#555" }}>
            <li>
              This app is currently in the approval process with and the
              application is approved. Please see{" "}
              <a
                href="https://github.com/yashwanthm/cowin-vaccine-booking/issues/95"
                target="_blank"
                rel="noreferrer"
              >
                Status of Approval
              </a>
              .
            </li>
            <li>
              If you have an issue about getting blocked, please add a comment
              here{" "}
              <a
                href="https://github.com/yashwanthm/cowin-vaccine-booking/issues/96"
                target="_blank"
                rel="noreferrer"
              >
                https://github.com/yashwanthm/cowin-vaccine-booking/issues/96
              </a>{" "}
              along with clear details explaining your usage pattern.
            </li>
            <li>
              If you are on mobile, please make sure that the browser doesn't go
              into background or your screen gets locked. If that happens, the
              tracking will pause automatically. If that happens, please close
              the browser in the background only before opening it.
            </li>
            <li>
              The app could automatically book when availability is detected.
              Please be sure of your vaccination preferences before you start
              tracking.
            </li>
          </ol>
        </header>

        <Row>
          <Col>
            {this.renderBookingPreferences()}
            {isAuthenticated ? null : (
              <div style={{ marginTop: 20 }}>
                <h2>Login</h2>
                {this.state.enableOtp ? null : (
                  <Search
                    placeholder={
                      this.state.mobile ? this.state.mobile : "Mobile Number"
                    }
                    allowClear
                    defaultValue={this.state.mobile || null}
                    type="number"
                    enterButton={"Generate OTP"}
                    size="large"
                    onSearch={(e) => {
                      this.setState(
                        {
                          mobile: e === "" ? this.state.mobile : e,
                          enableOtp: true,
                        },
                        () => {
                          this.generateOtp();
                        }
                      );
                    }}
                  />
                )}
                {this.state.enableOtp ? (
                  <span>
                    <Search
                      placeholder="Enter OTP"
                      allowClear
                      type="number"
                      autoFocus={true}
                      enterButton={"Submit"}
                      size="large"
                      onSearch={(e) => {
                        this.setState({ otp: e }, () => {
                          this.verifyOtp();
                        });
                      }}
                    />
                    <Button
                      danger
                      onClick={(e) => {
                        this.setState({ enableOtp: false });
                      }}
                      type="link"
                    >
                      Cancel
                    </Button>
                  </span>
                ) : null}
              </div>
            )}

            {isAuthenticated ? (
              <div>
                <h2>Beneficiaries</h2>
                {beneficiaries.length === 0 ? (
                  <p>
                    You do not have ANY benificiares added yet. Please login to{" "}
                    <a
                      href="https://www.cowin.gov.in/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Cowin
                    </a>{" "}
                    and add beneficiaries
                  </p>
                ) : (
                  <p>
                    Select beneficiaries to book a slot automatically when
                    there's availability. This app can continuously track
                    availability and make a booking.
                  </p>
                )}
                {beneficiaries.map((b) => {
                  return (
                    <Row key={b.beneficiary_reference_id}>
                      <Checkbox
                        disabled={this.state.isWatchingAvailability}
                        checked={
                          selectedBeneficiaries.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          }) !== -1
                        }
                        onClick={(e) => {
                          let sbs = this.state.selectedBeneficiaries;
                          let idx = sbs.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          });
                          if (idx === -1) {
                            sbs.push(b);
                          } else {
                            sbs.splice(idx, 1);
                          }
                          this.setState({ selectedBeneficiaries: sbs });
                          this.setStorage();
                        }}
                      >
                        {b.name} -{" "}
                        <i style={{ color: "#999" }}>
                          {b.vaccination_status}{" "}
                          {b.vaccine !== "" ? `with ${b.vaccine}` : null}
                        </i>
                      </Checkbox>
                    </Row>
                  );
                })}
                <Button
                  type="link"
                  danger
                  onClick={(e) => {
                    delete localStorage.token;
                    delete localStorage.appData;
                    window.location.reload();
                  }}
                  rel="noreferrer"
                  target="_blank"
                >
                  Logout
                </Button>{" "}
              </div>
            ) : null}

            <Checkbox
              style={{ marginTop: 15 }}
              checked={this.state.sessionBasedTracking}
              onClick={(e) => {
                this.clearWatch();
                this.setState({
                  sessionBasedTracking: !this.state.sessionBasedTracking,
                });
              }}
            >
              Search for selected date only (Alternate tracking mode)
            </Checkbox>
            <br />
            <Text type="secondary">
              (Use this in case you think that the app is not picking up
              availability. If you are tracking ANY telegram channels and the
              app doesn't pick up the avaiable slot within seconds, toggle this
              and track again to detect availability instantly. When alternate
              tracking is disabled, the app can track up to 7 days from the
              selected date.)
            </Text>

            {this.renderTrackingSelection()}

            
          </Col>
        </Row>

        {this.state.showCaptcha ? this.renderCaptcha() : null}

        {this.state.sessionBasedTracking
          ? this.renderSessionTable()
          : this.renderTable()}

        <div
          style={{ float: "left", clear: "both" }}
          ref={(el) => {
            this.messagesEnd = el;
          }}
        ></div>
        {this.renderDonate()}

        <h3 style={{ marginTop: 15, marginBottom: 0 }}>Share</h3>
        {this.renderShare()}

        <div style={{ marginTop: 10 }}></div>

        {this.renderModal()}

        <div>
          <Row>
            <GitHubButton
              href="https://github.com/yashwanthm/cowin-vaccine-booking"
              data-color-scheme="no-preference: dark; light: light; dark: dark_dimmed;"
              data-size="large"
              data-show-count="true"
              aria-label="Star yashwanthm/cowin-vaccine-booking on GitHub"
            >
              Star
            </GitHubButton>
            <Button
              type="link"
              href="https://github.com/yashwanthm/cowin-vaccine-booking/issues"
              rel="noreferrer"
              target="_blank"
            >
              Report an issue
            </Button>{" "}
            <Button
              type="link"
              href="https://github.com/yashwanthm/cowin-vaccine-booking/"
              rel="noreferrer"
              target="_blank"
            >
              Git Repo is here
            </Button>
            <Button
              type="link"
              onClick={(e) => {
                this.setState({ showPrivacyPolicy: true });
              }}
            >
              Privacy Policy
            </Button>
            <Button
              type="link"
              href="https://5c0x1zkltbk.typeform.com/to/s3Vo8L6E"
              rel="noreferrer"
              target="_blank"
            >
              Contact
            </Button>
          </Row>
        </div>
        <Text code>Build last updated at: {version}</Text>

        <Modal
          title=""
          okText="Close"
          footer={[
            <Button
              key="back"
              onClick={(e) => {
                this.setState({ showPrivacyPolicy: false });
              }}
            >
              Close
            </Button>,
          ]}
          visible={this.state.showPrivacyPolicy}
          onOk={(e) => {
            this.setState({ showPrivacyPolicy: false });
          }}
        >
          {parseHTML(privacy)}
        </Modal>
        {this.renderPayTMQR()}
      </div>
    );
  }
}
