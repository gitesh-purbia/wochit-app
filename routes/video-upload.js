var express = require('express');
var router = express.Router();
var parser = require('xml2json');
const http = require('https');
var moment = require('moment');

const path = require('path');
const { promises: fs } = require('fs');
const fileMethod = require('fs');
const xmlFilesPath = path.join('public', 'xml');
const directoryPath = path.join('public', 'videos');
const axios = require('axios');
const wochiEndpoint = '';
const clientId = 'a5318859-1711-46fa-ba12-f1f29894a89d';
const clientSecret = 'a2tqZnZ2NzltOW02YzVxNmNqOHJ1MjlmMXU4cTA5N2NrazVtOWprMWR2aDJqdWxjdWY=';
const X_API_KEY = 'BOGhFM1qGV2kFgLmPhjyS4NEFsBsGmyp3G2URJcq';

/* GET users listing. */
router.get('/', async function(req, res, next) {
  try {
    const files = await fs.readdir(xmlFilesPath);
    console.log('-----------------  Start ----------------------');
    console.log('-----------------  Total Files', files.length);
    for (const [index, file] of files.entries()) {
      console.log(`---- Processing file ${index + 1} of ${files.length}`);
      const xmlData = await fs.readFile(xmlFilesPath + '/' + file);
      const videoNameTemp = file.replace('xml', 'mp4');
      const isVideoExists = fileMethod.existsSync(directoryPath + '/' + videoNameTemp);
      if (isVideoExists) {
        var wochitJson = JSON.parse(parser.toJson(xmlData));
        let wochitObj = {};
        if (Object.keys(wochitJson)[0] === 'clip') {
          // find video id obj
          const videoId = wochitJson.clip.metadata.find((_m) => {
            return _m.name.toLowerCase() === 'ruptly.videoid';
          });
          // find title obj
          const titleObj = wochitJson.clip.metadata.find((_m) => {
            return _m.name.toLowerCase() === 'title';
          });
          // find date obj
          const dateObj = wochitJson.clip.metadata.find((_m) => {
            return _m.name.toLowerCase() === 'description.date';
          });
          const descriptionObj = wochitJson.clip.metadata.find((_m) => {
            return _m.name.toLowerCase() === 'description';
          });
          const videoName = file.replace('xml', 'mp4');
          wochitObj.type = 'VIDEO';
          wochitObj.contentType = 'Editorial';
          wochitObj.id = videoId.value;
          wochitObj.downloadUrl = 'http://89.245.128.150:3000/video/' + videoName;
          wochitObj.title = titleObj.value;
          wochitObj.caption = descriptionObj.value;

          let uDate;
          if (videoId) {
            let videoIdSplitted = videoId.value.toString();
            let dateString = videoIdSplitted.split('-')[0];
            let year = `${dateString[0]}${dateString[1]}${dateString[2]}${dateString[3]}`;
            let month = `${dateString[4]}${dateString[5]}`;
            let day = `${dateString[6]}${dateString[7]}`;
            let finalDate = new Date();
            finalDate.setFullYear(parseInt(year));
            finalDate.setMonth(parseInt(month) - 1);
            finalDate.setDate(parseInt(day));
            uDate = new Date(finalDate);
          } else {
            uDate = new Date();
          }
          let updatedDate = moment(uDate).utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
          wochitObj.publicationDate = updatedDate;
          console.log('==== wochit final object ====', wochitObj);
        } else if (Object.keys(wochitJson)[0] === 'nsml') {
          // find title obj
          const titleObj = wochitJson.nsml.fields.string.find((_m) => {
            return _m.id.toLowerCase() === 'title';
          });
          // find video id obj
          const videoId = wochitJson.nsml.fields.string.find((_m) => {
            return _m.id.toLowerCase() === 'video-id';
          });
          // find date obj
          const dateObj = wochitJson.nsml.fields.date.find((_m) => {
            return _m.id.toLowerCase() === 'create-date';
          });
          // find description
          const descriptionArr = wochitJson.nsml.body.p;
          let description = '';
          descriptionArr.forEach(des => {
            if (typeof des === 'string') {
              description = description + ' ' + des;
            }
          });
          const videoName = file.replace('xml', 'mp4');
          wochitObj.type = 'VIDEO';
          wochitObj.contentType = 'Editorial';
          wochitObj.downloadUrl = 'http://89.245.128.150:3000/video/' + videoName;
          wochitObj.title = titleObj.$t;
          wochitObj.id = videoId.$t;

          let uDate;
          if (videoId) {
            let videoIdSplitted = videoId.$t.toString();
            let dateString = videoIdSplitted.split('-')[0];
            let year = `${dateString[0]}${dateString[1]}${dateString[2]}${dateString[3]}`;
            let month = `${dateString[4]}${dateString[5]}`;
            let day = `${dateString[6]}${dateString[7]}`;
            let finalDate = new Date();
            finalDate.setFullYear(parseInt(year));
            finalDate.setMonth(parseInt(month) - 1);
            finalDate.setDate(parseInt(day));
            uDate = new Date(finalDate);
          } else {
            uDate = new Date();
          }
          
          let updatedDate = moment(uDate).utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
          wochitObj.publicationDate = updatedDate;
          
          wochitObj.caption = description; // need to be discuess
          console.log('==== wochit final object ====', wochitObj);
        } else {
          console.log('========== Unhandled XML File type ==========', file);
        }
        const tokenData = await getWochitApiToken();
        const uploadDetails = await postWochitIngestApi(wochitObj, tokenData.token);
        console.log('-------------Upload Details-------------', uploadDetails);
        fileMethod.unlink(path.join(xmlFilesPath, file), err => {
          if (err) throw err;
          // fileMethod.unlink(path.join(directoryPath, videoNameTemp), err => {
          //   if (err) throw err;
          // });
        });
      } else {
        console.log('------ Video does not exists with name ' + videoNameTemp + ' for xml file' + file);
      }
    }
    console.log('======= finish ====');
  } catch (err) {
    console.log(err);
  }
});

function getWochitApiToken() {
  return new Promise((resolve, reject)=> {
    let baseAuthCreds = Buffer.from(clientId+':'+clientSecret, 'binary').toString('base64');
    let options = {
      'method': 'POST',
      'hostname': 'ingest-api.wochit.com',
      'path': '/api/v1/oauth/access_token',
      'headers': {
        'Content-Type': 'application/json',
        'x-api-key': X_API_KEY,
        'Authorization': 'Basic '+ baseAuthCreds,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Host': 'ingest-api.wochit.com',
        'Accept-Encoding': 'gzip, deflate',
      }
    };
    let req = http.request(options, function (res) {
      var chunks = [];
      res.on("error", function (error) {
        return reject(error);
      })
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
      res.on("end", function () {
        var body = Buffer.concat(chunks);
        body = JSON.parse(body.toString());
        return resolve(body);
      });
    }); 
    req.end();
  });
}

function postWochitIngestApi(videoData, token){
  console.log('====================================');
  console.log('CALLING WOCHIT API FOR', videoData.id);
  console.log('====================================');
  return axios({
    method: 'post',
    headers: {
      'Authorization': 'Bearer '+token,
      'x-api-key': 'BOGhFM1qGV2kFgLmPhjyS4NEFsBsGmyp3G2URJcq'
    },
    url:'https://ingest-api.wochit.com/api/v1/assets',
    data: {
      "mediaProviderAssetModels": [videoData]
    }
  })
  .then(response => {
    let wochitResponse = response.data;
    console.log('====================================');
    console.log("WOCHIT RESPONSE", wochitResponse);
    console.log('====================================');
    wochitResponse.videoData = videoData;
    wochitResponse.updated = true;
    return wochitResponse;
  })
  .catch(error => {
    console.log('====================================');
    console.log("ERROR in POST ", error);
    console.log('====================================');
    error.upadted = false;
    return error;
  });
}

module.exports = router;
