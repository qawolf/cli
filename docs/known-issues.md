# Known issues

This page tracks known issues in `@qawolf/cli` and our plans to address them.

## Security advisories in the mobile-automation dependency stack

Some transitive dependencies used by the mobile-automation stack (Appium and WebdriverIO) currently have published security advisories. These dependencies are only pulled in by mobile (Android and iOS) flows; web flows do not load or execute this code and are unaffected.

The advisories originate in upstream packages that we depend on indirectly, and the fixes require a major version upgrade of those mobile-automation libraries. That upgrade is planned for an upcoming release. Until then, the affected code paths are exercised only when running mobile flows.

If you run web flows exclusively, no action is needed. We will update this note once the upgrade ships.
