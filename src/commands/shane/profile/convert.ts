import { SfdxCommand, core } from '@salesforce/command';
import * as _ from 'lodash';
import fs = require('fs-extra');
import jsToXml = require('js2xmlparser');

import { getExisting } from '../../../shared/getExisting';
import { setupArray } from '../../../shared/setupArray';

import * as options from '../../../shared/js2xmlStandardOptions';

import chalk from 'chalk';

const thingsThatMigrate = [
  { profileType : 'applicationVisibilities',
    permSetType: 'applicationVisibilities',
    key: 'application'
  },
  { profileType: 'classAccesses',
    permSetType: 'classAccesses',
    key: 'apexClass'
  },
  { profileType: 'externalDataSourceAccesses',
    permSetType: 'externalDataSourceAccesses',
    key: 'externalDataSource'
  },
  { profileType: 'fieldPermissions',
    permSetType: 'fieldPermissions',
    key: 'field'
  },
  { profileType: 'objectPermissions',
    permSetType: 'objectPermissions',
    key: 'object'
  },
  { profileType: 'pageAccesses',
    permSetType: 'pageAccesses',
    key: 'apexPage'
  },
  { profileType: 'recordTypeVisibilities',
    permSetType: 'recordTypeVisibilities',
    key: 'recordType'
  },
  { profileType: 'tabVisibilities',
    permSetType: 'tabSettings',
    key: 'tab'
  }
];

export default class PermSetConvert extends SfdxCommand {

  public static description = 'convert a profile into a permset';

  public static examples = [
`sfdx shane:profile:convert -p Admin -n MyNewPermSet -e
// create a permset in force-app/main/default from the Admin profile (profiles/Admin).  If MyNewPermSet doesn't exist, it will be created.  Content is removed from Admin profile (-e)
`
  ];

  protected static flagsConfig = {
    name: { type: 'string',  char: 'n', required: true, description: 'path to existing permset.  If it exists, new perms will be added to it.  If not, then it\'ll be created for you' },
    profile: { type: 'string',  char: 'p', required: true, description: 'API name of an profile to convert.  If blank, then you mean ALL the objects and ALL their fields and ALL their tabs' },
    directory: { type: 'string',  char: 'd', default: 'force-app/main/default', description: 'Where is all this metadata? defaults to force-app/main/default' },
    editProfile: { type: 'boolean',  char: 'e', description: 'remove metadata from profile'}
  };

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = true;

  public async run(): Promise<any> { // tslint:disable-line:no-any

    const targetFilename = `${this.flags.directory}/permissionsets/${this.flags.name}.permissionset-meta.xml`;
    const targetProfile = `${this.flags.directory}/profiles/${this.flags.profile}.profile-meta.xml`;

    // verify profile's existence locally
    if (!fs.existsSync(targetProfile)) {
      throw new Error(`profile not found: ${targetProfile}`);
    }

    let existing = await getExisting(targetFilename, 'PermissionSet', {
      '@': {
        xmlns: 'http://soap.sforce.com/2006/04/metadata'
      },
      'hasActivationRequired': 'false',
      'label': this.flags.name
    });

    let profile = await getExisting(targetProfile, 'Profile');

    thingsThatMigrate.forEach( (item) => {
      if (profile[item.profileType]) {

        profile = setupArray(profile, item.profileType);
        existing = setupArray(existing, item.permSetType);

        this.ux.log(`copying ${item.profileType} to perm set`);
        existing[item.permSetType] = _.unionBy(existing[item.permSetType], profile[item.profileType], item.key); // merge profile with existing permset array

        // special handling for applicationVisibility (default not allowed in permset)
        if (item.permSetType === 'applicationVisibilities') {
          const aVs = existing.applicationVisibilities;
          aVs.forEach((aV) => {
            delete aV.default;
          });
          existing.applicationVisibilities = aVs;
        }

        if (this.flags.editProfile) {
          delete profile[item.profileType];
        }
      } else {
        this.ux.log(`found no ${item.profileType} on the profile`);
      }

    });

    // correct @ => $ issue
    if (existing['$']) {
      const temp = existing['$'];
      delete existing['$'];
      existing['@'] = temp;
    }

    fs.ensureDirSync(`${this.flags.directory}/permissionsets`);

    // convert to xml and write out the file
    const permSetXml = jsToXml.parse('PermissionSet', existing, options.js2xmlStandardOptions);
    fs.writeFileSync(targetFilename, permSetXml);

    if (this.flags.editProfile) {
      // correct @ => $ issue
      if (profile['$']) {
        const temp = profile['$'];
        delete profile['$'];
        profile['@'] = temp;
      }
      const profileXml = jsToXml.parse('Profile', profile, options.js2xmlStandardOptions);
      fs.writeFileSync(targetProfile, profileXml);
      this.ux.log(`Permissions removed from ${targetProfile}`);
    }

    this.ux.log(chalk.green(`Permissions added in ${targetFilename}`));
    return existing; // for someone who wants the JSON?
  }

}
