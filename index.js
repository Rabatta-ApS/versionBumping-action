const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/action");
const fs = require("fs");
const path = require("path");

let cur_ver;
let new_ver;
let was_bumped;

async function main(){
  try {
    const pathToVersionFile = core.getInput('path-to-version-file', { required: true });
    const mode = core.getInput('mode');
    const newVersion= core.getInput('new-verison');

    cur_ver = "";
    new_ver = "";
    was_bumped = false;

    if(!process.env.GITHUB_TOKEN){
      throw new Error("GITHUB_TOKEN env not set");
    }

    if(mode == "GET_VERSION"){
      cur_ver = getVersion(pathToVersionFile);
      new_ver = updateVersion(cur_ver);
    }
    else if(mode == "BUMP_VERSION"){
      cur_ver = getVersion(pathToVersionFile);
      new_ver = updateVersion(cur_ver);
      updateVersionFile(pathToVersionFile, new_ver);
      was_bumped = cur_ver != new_ver;
    }
    else if(mode == "SET_VERSION"){
      cur_ver = getVersion(pathToVersionFile);
      new_ver = newVersion;
      updateVersionFile(pathToVersionFile, new_ver);
      was_bumped = cur_ver != new_ver;
    }
    else{
      throw new Error("Mode not recognised");
    }
    
  } catch (error) {
    core.setFailed(error.message);
  }
  finally{
    core.setOutput("cur_version", cur_ver);
    core.setOutput("new_version", new_ver);
    core.setOutput("was_bumped", was_bumped);
  }
}

function getVersion(pathToFile){
  return fs.readFileSync(path.resolve(pathToFile), {encoding: 'utf8'});
}

async function updateVersion(version){
  const labels = await getLabels();

  const versionNumbers  = version.match(/\d/g);
  for(let i = 0; i < versionNumbers.length; i++){
    versionNumbers[i] = Number.parseInt(versionNumbers[i]);
  }

  for(const label of labels){
    core.debug(label);
    if(label == "release:major"){
      versionNumbers[0]++;
      versionNumbers[1] = 0;
      versionNumbers[2] = 0;

    } 
    else if(label == "release:minor"){
      versionNumbers[1]++;
      versionNumbers[2] = 0;
    }
    else if(label == "release:patch"){
      versionNumbers[2]++;
    }
  }

  const versionString = `${versionNumbers[0]}.${versionNumbers[1]}.${versionNumbers[2]}`;

  return versionString;
}

async function getLabels(){
  const octokit = new Octokit();
  const context = github.context;
  const PRS = await octokit.request('GET /repos/{owner}/{repo}/pulls?state=all', {
    owner: context.payload.repository.owner.name,
    repo: context.payload.repository.name
  });
  const prToMaster = PRS.data.find(pr => pr.merge_commit_sha == context.payload.after);
  
  let labels = prToMaster.labels;
  return labels ? labels.map(label => label.name) : [];
}

function updateVersionFile(pathToFile, newVersion){
  fs.writeFileSync(path.resolve(pathToFile), newVersion);
}

main();


