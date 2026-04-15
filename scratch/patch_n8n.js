const fs = require('fs');

const originalN8nPath = '/Users/alexanderliapustin/Downloads/Holodos (13).json';
const patchNodesPath = '/Users/alexanderliapustin/Desktop/Antigravity2/backend/n8n/patch_nodes.json';
const outputN8nPath = '/Users/alexanderliapustin/Downloads/Holodos (13)_patched.json';

const n8nData = JSON.parse(fs.readFileSync(originalN8nPath, 'utf8'));
const patchData = JSON.parse(fs.readFileSync(patchNodesPath, 'utf8'));

// Find Voice Node Patch
const patchVoiceNode = patchData.nodes.find(n => n.name === 'Prepare Data Voice');
const patchImageNode = patchData.nodes.find(n => n.name === 'Prepare Image1');

// Update in original
for (let node of n8nData.nodes) {
  if (node.name === 'Prepare Data Voice' && patchVoiceNode) {
    node.parameters.jsCode = patchVoiceNode.parameters.jsCode;
    console.log('Patched Prepare Data Voice');
  }
  if (node.name === 'Prepare Image1' && patchImageNode) {
    node.parameters.jsCode = patchImageNode.parameters.jsCode;
    console.log('Patched Prepare Image1');
  }
}

fs.writeFileSync(outputN8nPath, JSON.stringify(n8nData, null, 2));
console.log('Successfully saved patched JSON to', outputN8nPath);
