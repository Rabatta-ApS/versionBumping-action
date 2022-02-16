const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/action");
const fs = require("fs");
const path = require("path");


async function main(){
  try {
    const pathToManifest = core.getInput('path-to-manifest', { required: true });
    const mode = core.getInput('mode');
    let newManifestVersion = core.getInput('new-verison');

    const jsonData = getJsonFromManifest(pathToManifest);

    if(mode != 'set'){
      const oldManifestVersion = jsonData.version;
      newManifestVersion = await updatedManifestVersion(oldManifestVersion);
    }
    
    core.setOutput('version', newManifestVersion);
    
    if(mode != 'get'){
      jsonData.version = newManifestVersion;
      updateManifest(pathToManifest, jsonData);
    }
    
  } catch (error) {
    core.error(error.message);
  }
}

function getJsonFromManifest(pathToManifest){
  const rawData = fs.readFileSync(path.resolve(pathToManifest));
  return JSON.parse(rawData);
}

async function updatedManifestVersion(version){
  const labels = await getLabels();

  const versionNumbers  = version.match(/\d/g);
  for(let i = 0; i < versionNumbers.length; i++){
    versionNumbers[i] = Number.parseInt(versionNumbers[i]);
  }

  let noRelease = false;
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
    else if(label == "release:none"){
      noRelease = true;
    }
  }

  core.setOutput('no-release', noRelease);

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

function updateManifest(pathToManifest, jsonData){
  const data = JSON.stringify(jsonData, null, 2);
  fs.writeFileSync(path.resolve(pathToManifest), data);
}

main();


