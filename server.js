if(process.env.NODE_ENV !== "production"){
    require('dotenv').config();
}
const express = require('express');
const app = express();
const path = require('path');
const { urlencoded } = require('body-parser');
const methodOverride = require('method-override')
const port = 3000;
const mongoose = require('mongoose');
const Doctor = require('./models/doctor');
const Admin = require('./models/admin');
const Patient = require('./models/patient');
const Appointment=require('./models/appointment');
const categories=['dentist','dermatologist','gynecologist','pediatrician'];
const {storage} = require('./cloudinary');
const multer  = require('multer');
const upload = multer({storage});

// --------------------------------------------------------------------------------------------------------------
mongoose.connect('mongodb://localhost:27017/sahayata', {useNewUrlParser: true, useUnifiedTopology: true})
.then(()=>{
    console.log("Connection Open");
})
.catch((e)=>{
    console.log(e);
})
// --------------------------------------------------------------------------------------------------------------
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views')); 
mongoose.set('useFindAndModify', false);
app.use(express.static(__dirname + '/public'))
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'))
// --------------------------------------------------------------------------------------------------------------

// Routes are defined below
// --------------------------------------------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/signup',(req,res)=>{
    res.redirect('/doctorSignup');
})

app.get('/about',(req,res)=>{
    res.redirect('/');
});

//###### LOGIN START #######
// --------------------------------------------------------------------------------------------------------------
app.get('/login',(req,res)=>{
    res.render('login');
})

app.post('/login',async (req,res)=>{
    let {username,password}=req.body;
    console.log("Username: ",username);
    console.log("Password: ",password);
    let account=await Patient.findOne({email:username,password:password});
    console.log(account);    
    if(account){        
        res.redirect(`/patient/${account._id}`);
        // res.send("Welcome Patient!!!");
    }
    else{
        account=await Doctor.findOne({email:username,password:password});
        console.log(account);
        if(account){
            let text = "Please wait for the admin to review your application !! ";
            if(account.isVerified == 2) text = "Your application was rejected by admin :(";
            if(account.isVerified == 0 || account.isVerified == 2)
            return res.render('adminApproval',{message : text})
            else return res.redirect(`/doctor/${account._id}`);
        }
        else{
            res.redirect('/login');
        }
    }
})

//###### LOGIN END #######
// --------------------------------------------------------------------------------------------------------------


//###### DOCTOR START #######
// Doctor Signup 
// --------------------------------------------------------------------------------------------------------------
app.get('/doctorSignup',(req,res)=>{
    res.render('doctorSignup');
})

app.post('/doctorSignup', (upload.single('license')),(req,res)=>{
    const {firstName,lastName,email,password,age,specialization} = req.body;
    const license = req.file.path;
    console.log(license);
    const newDoctor = {
        firstName   :       firstName, 
        lastName    :       lastName,
        email       :       email,
        password    :       password,
        age         :       age,
        license     :       license,
        specialization :    specialization,
        isVerified  :       false
    }
    console.log(newDoctor);
    const doctorToInsert = new Doctor(newDoctor);
    doctorToInsert.save()
    .then(()=>{
        console.log("Doctor added in DB");
    })
    .catch((e)=>{
        console.log(e);
    })
    res.redirect('/login');
})
// Doctor Signup Ends

//Doctor Dashboard
app.get('/doctor/:id',async (req,res)=>{
    let {id}=req.params;
    let doctor =await Doctor.findById(id);
    let pendingApps=await Appointment.find({doctorID:id,isAccepted:0}).populate('patientID');
    let ongoingApps=await Appointment.find({doctorID:id,isAccepted:1}).populate('patientID');
    res.render('doctorDashboard',{doctor,pendingApps,ongoingApps});
})

// Doctor Viewing appointment requests
app.get('/doctor/:id/requests',async (req,res)=>{
    let {id}=req.params;
    let doctor =await Doctor.findById(id);
    let pendingApps = await Appointment.find({doctorID:id,isAccepted:0}).populate('patientID');
    // let ongoingApps=await Appointment.find({doctorID:id,isAccepted:1}).populate('patientID');
    res.render('doctorAppointmentRequests',{doctor,pendingApps});
})

// Doctor accepting appointment request
app.post('/doctor/:id/requests/:appID',async (req,res)=>{
    const {id,appID} = req.params;
    let appointment = await Appointment.findById(appID);
    appointment.isAccepted = 1;
    appointment.messageBody
    await appointment.save();
    let debug = await Appointment.findById(appID);
    console.log("Checking if appointment is accepted or not");
    console.log(debug);
    res.redirect(`/doctor/${id}/requests`);
})

// doctor rejecting appointment request
app.delete('/doctor/:id/requests/:appID',async (req,res)=>{
    const {id,appID} = req.params;
    let appointment = await Appointment.findById(appID);
    appointment.isAccepted = 2;
    await appointment.save();
    let debug = await Appointment.findById(appID);
    console.log("Checking if appointment is rejected or not");
    console.log(debug);
    res.redirect(`/doctor/${id}/requests`);
})
// --------------------------------------------------------------------------------------------------------------
//###### DOCTOR END #######


//###### PATIENT START #######

// Patient Signup Starts here
// --------------------------------------------------------------------------------------------------------------
app.get('/patientSignup',(req,res)=>{
    res.render('patientSignup');
})
app.post('/patientSignup',async (req,res)=>{
    const {firstName,lastName,gender,email,phone,password,city,age}=req.body;
    const new_patient=new Patient({
        firstName:firstName,
        lastName:lastName,
        gender:gender,
        email:email,
        phone:phone,
        password:password,
        city:city,
        age:age
    });
    await new_patient.save();
    res.redirect('/login');
})
// Patient Signup ends here
// --------------------------------------------------------------------------------------------------------------

//Patient Dashboard
// --------------------------------------------------------------------------------------------------------------
// directly to patientDashboard
app.get('/patient/:id',async (req,res)=>{
    let {id}=req.params;
    let patient=await Patient.findById(id);
    let pendingApps=await Appointment.find({patientID:id,isAccepted:0}).populate('doctorID');
    let ongoingApps=await Appointment.find({patientID:id,isAccepted:1}).populate('doctorID');
    let rejectedApps=await Appointment.find({patientID:id,isAccepted:2}).populate('doctorID');
    res.render('patientDashboard',{patient,pendingApps,ongoingApps,rejectedApps});
})

app.delete('/patient/:id/deleteAppointment/:appid',async(req,res)=>{
    let {id,appid}=req.params;
    let appointment=await Appointment.findById(appid);  
    appointment.isAccepted=3;
    await appointment.save();
    res.redirect(`/patient/${id}`);
})

// view list of doctors in choosen category
app.get('/patient/:id/viewdoctors',async (req,res)=>{
    let {id}=req.params;
    let {query}=req.query;
    if(!query)
        query='all';
    let account=await Patient.findById(id);
    let doctorData;
    if(query==='all')
        doctorData=await Doctor.find({isVerified : 1});
    else
        doctorData=await Doctor.find({specialization:query,isVerified : 1});
    res.render('patientViewingDoctors.ejs',{account,doctorData,query,categories});
})
// view a particular doctor
app.get('/patient/:id/viewdoctors/:docid',async(req,res)=>{
    let {id,docid}=req.params;
    let account=await Patient.findById(id);
    let doctor=await Doctor.findById(docid);
    res.render('patientViewingDoctorProfile.ejs',{account,doctor});
})

// make an appointment with a particular doctor
app.post('/patient/:id/makeappointment/:docid',async (req,res)=>{
    let {id,docid}=req.params;
    let {title,description} = req.body;

    // let account=await Patient.findById(id);
    const foundDoctor = await Doctor.findById(docid);
    const foundPatient = await Patient.findById(id);

    let newAppointment = new Appointment();
    // adding doctor and patient id to appointment object
    newAppointment.doctorID=foundDoctor;
    newAppointment.patientID=foundPatient;
    newAppointment.title = title;
    newAppointment.description = description;

    // add basic message in the appointment window
    let patMessage = {
        text : `Description: ${newAppointment.description}`,
        isPat : 1
    }
    newAppointment.messageBody.push(patMessage);
    let docMessage = {
        text : `Hello ${foundPatient.firstName}`,
        isPat : 0
    }
    newAppointment.messageBody.push(docMessage);
    docMessage = {
        text : `I have seen your description`,
        isPat : 0
    }
    newAppointment.messageBody.push(docMessage);
    docMessage = {
        text : `I will soon get back to you`,
        isPat : 0
    }
    newAppointment.messageBody.push(docMessage);
    // save the appointment in database
    const appointmentSaved = await newAppointment.save();

    // add appointment id in doctors appointmentRequest 
    foundDoctor.appointmentRequest.push(appointmentSaved);
    await foundDoctor.save();

    // add appointment id in patient appointmentRequest 
    foundPatient.appointmentRequest.push(appointmentSaved);
    await foundPatient.save();

    // redirect to the doctor profile view page 
    res.redirect(`/patient/${id}/viewdoctors`);
})
// Patient Dashboard ends here


//Appointment Window 
// 1 represents patient has opened the appointment window
app.get('/appointment/1:id/', async (req,res)=>{
    const {id} = req.params;
    const appointment = await Appointment.findById(id);
    const doctor = await Doctor.findById(appointment.doctorID);
    const patient = await Patient.findById(appointment.patientID);
    res.render('appointmentWindow', {appointment,patient,doctor,isPat : 1});
})
// 0 represents doctor has opened the appointment window
app.get('/appointment/0:id/', async (req,res)=>{
    const {id} = req.params;
    const appointment = await Appointment.findById(id);
    const doctor = await Doctor.findById(appointment.doctorID);
    const patient = await Patient.findById(appointment.patientID);
    res.render('appointmentWindow', {appointment,patient,doctor,isPat : 0});
})
// message sent
// this post route handles message sent from both doctor and patient
app.post('/appointment/:id',async (req,res)=>{
    const {id} = req.params;
    const {messageBody} = req.body;
    const isPat = id[0];
    // // isPat = 0 , patient sent the message
    const newMessageBody = {
        text : messageBody,
        isPat : isPat
    }
    const appID = id.slice(1);
    const appointment = await Appointment.findById(appID);
    appointment.messageBody.push(newMessageBody);
    appointment.save();
    res.redirect(`/appointment/${id}`);
})
// --------------------------------------------------------------------------------------------------------------
//###### PATIENT END #######



//###### ADMIN START #######

app.get('/admin',(req,res)=>{
    res.render('adminlogin');
})

//renders the admin login page
app.post('/admin',async (req,res)=>{
    const {email , password} = req.body;
    console.log(email);
    console.log(password);
    const data = await Admin.findOne({email: email,password: password});
    if(data) res.redirect(`/admin/${data._id}`);
    else res.redirect('/admin');
    
})

// renders form to add new admin
app.get('/admin/new', (req,res)=>{
    res.render('adminform');
})


app.post('/admin/new',async (req,res)=>{
    const {firstName, lastName, email,password} = req.body;
    const adminseedprod = {
        firstName   :   firstName, 
        lastName    :   lastName,
        email       :   email,
        password    :   password,
    }
    const admintoinsert = new Admin(adminseedprod);
    admintoinsert.save()
    .then(()=>{
        console.log("Admin added in DB");
    })
    .catch((e)=>{
        console.log(e);
    })
    res.redirect('/admin');

})


//renders admin dashboard
app.get('/admin/:id', async(req,res)=>{
    const { id } = req.params; 
    const data = await Admin.findById(id);
    const doctor = await Doctor.find({isVerified : 0}); 
    res.render('adminDashboard',{ data ,doctor});
})

app.patch('/admin/:adid/:docid', async(req,res)=>{
    const {adid , docid} = req.params;
    Doctor.findByIdAndUpdate(docid,{ "isVerified" : "1"}, function(err,result){
        if(err){
            console.log(err);
        }
    });
    res.redirect(`/admin/${adid}`);

})

app.delete('/admin/:adid/:docid', async(req,res)=>{
    const {adid , docid} = req.params;
    Doctor.findByIdAndUpdate(docid,{ "isVerified" : "2"}, function(err,result){
        if(err){
            console.log(err);
        }
    });
    res.redirect(`/admin/${adid}`);
})

//###### ADMIN END #######

// ERROR 404 ROUTE:----------------------------------------
app.get('*',(req,res)=>{
	res.render('PageNotFound');
})
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});

