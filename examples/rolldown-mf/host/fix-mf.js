// A simple script to help debug Module Federation resolution
const deps = [
  {
    name: 'rolldown-remote',
    application_uid: 'rolldown-remote.zephyr-packages.zephyrcloudio',
    default_url: 'https://zephyr-cloud.io/remoteEntry.js',
    remote_entry_url:
      'https://nestor-lopez-1038-rolldown-remote-zephyr-packages-ff79d8a6d-ze.zephyr-cloud.io/remoteEntry.js',
    version: 'http://localhost:8085/mf-manifest.json',
  },
];

const remoteName = 'rolldown_remote';
const versionToFind = 'http://localhost:8085/mf-manifest.json';

// Standard equality check
const standardMatch = deps.find(
  (dep) => dep.name === remoteName && dep.version === versionToFind
);
console.log('Standard match:', standardMatch ? true : false);

// Normalized check - handles underscore vs hyphen differences
const normalizedMatch = deps.find((dep) => {
  const normalizedDepName = dep.name.replace(/-/g, '_');
  const normalizedRemoteName = remoteName.replace(/-/g, '_');
  const nameMatches = normalizedDepName === normalizedRemoteName;
  const versionMatches = dep.version === versionToFind;
  console.log(`${normalizedDepName} === ${normalizedRemoteName} = ${nameMatches}`);
  console.log(`${dep.version} === ${versionToFind} = ${versionMatches}`);
  return nameMatches && versionMatches;
});
console.log('Normalized match:', normalizedMatch ? true : false);

// Simple equality - just showing the values for clarity
console.log('rolldown-remote' === 'rolldown_remote'); // false
console.log('rolldown_remote' === 'rolldown_remote'); // true
console.log('rolldown-remote'.replace(/-/g, '_') === 'rolldown_remote'); // true
