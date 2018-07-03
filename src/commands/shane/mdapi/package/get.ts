import { SfdxCommand, core } from '@salesforce/command';
import util = require('util');
import child_process = require('child_process');

const exec = util.promisify(child_process.exec);

const tmpDir = 'mdapiout';

export default class Get extends SfdxCommand {

  public static description = 'gets package from an org, converts, and merges it into the local source';

  public static examples = [
`sfdx shane:mdapi:package:get -p MyPkg -u someOrg
// pulls a package from the org and converts/merges it into force-app
`,
`sfdx shane:mdapi:package:get -p MyPkg -u someOrg -t someDir
// pulls a package from the org and converts/merges it into /someDir
`
  ];

  protected static requiresUsername = true;

  protected static flagsConfig = {
    packageName: {type: 'string', required: true, char: 'p', description: 'the name of the package you want to retrieve	' },
    target: {type: 'string', char: 't', default: 'force-app', description: 'where to convert the result to...defaults to force-app' }
  };

  protected static requiresProject = true;

  // tslint:disable-next-line:no-any
  public async run(): Promise<any> {

    process.stdout.write('starting package retrieval...');

    await exec(`sfdx force:mdapi:retrieve -s -p "${this.flags.packageName}" -u ${this.org.getUsername()}  -r ./${tmpDir} -w 30`);
    process.stdout.write('Package Retrieved.  Unzipping...');

    await exec(`unzip -o ./${tmpDir}/unpackaged.zip -d ./${tmpDir}`);
    process.stdout.write('Package Unzipped.  Converting...');

    await exec(`sfdx force:mdapi:convert -r ./${tmpDir} -d ${this.flags.target}`);
    process.stdout.write('Package Converted.  Cleaning up...');

    await exec(`rm -rf ./${tmpDir}`);
    this.ux.log('Done!');
  }
}
