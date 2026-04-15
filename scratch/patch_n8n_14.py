import json
import os

original_path = os.path.expanduser('~/Downloads/Holodos (14).json')
patch_path = '/Users/alexanderliapustin/Desktop/Antigravity2/backend/n8n/patch_nodes.json'
output_path = os.path.expanduser('~/Downloads/Holodos (14)_patched.json')

with open(original_path, 'r', encoding='utf-8') as f:
    n8n_data = json.load(f)

with open(patch_path, 'r', encoding='utf-8') as f:
    patch_data = json.load(f)

patch_voice_node = next((n for n in patch_data['nodes'] if n['name'] == 'Prepare Data Voice'), None)
patch_image_node = next((n for n in patch_data['nodes'] if n['name'] == 'Prepare Image1'), None)

for node in n8n_data['nodes']:
    if 'Prepare Data Voice' in node['name'] and patch_voice_node:
        node['parameters']['jsCode'] = patch_voice_node['parameters']['jsCode']
        print('Patched', node['name'])
    if 'Prepare Image' in node['name'] and patch_image_node:
        node['parameters']['jsCode'] = patch_image_node['parameters']['jsCode']
        print('Patched', node['name'])

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(n8n_data, f, indent=2, ensure_ascii=False)

print('Successfully saved patched JSON to', output_path)
