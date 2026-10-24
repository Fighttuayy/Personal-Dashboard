# Fortor's Dashboard

A personal workspace for tasks, deadlines, income, notes and selected team snapshots. English interface, dark crimson glass theme, light theme, four consistent overview modes and a fitted full-screen display.

## Data and privacy

The published files contain no personal records, demo seed, credentials or development assets. Each browser stores its own data locally. There is no login, server database, automatic device sync or live team collaboration. Team exports contain only the selected team's shared content. A full backup contains personal information and should be kept private.

Use **Export backup** in the old file, then **Import backup** on the new website to move existing work. Preview the record counts before restoring. Import replaces that browser's data; invalid backups are rejected, and a failed write leaves the active workspace unchanged. Legacy sample records are removed while genuine tasks, notes, work types and teams are retained.

Calendar export creates an .ics snapshot for Apple Calendar or another calendar app. Later dashboard edits do not automatically update imported calendar events.

## Deploy on GitHub Pages

Repository: **Fighttuayy/Personal-Dashboard**. Website files are in **public/**. In Settings → Pages choose **GitHub Actions**. Push to **main**, or run the deployment workflow manually. GitHub returns the live website URL in the successful deployment. Pages availability for private repositories depends on the GitHub plan; preserve the current repository visibility unless its owner explicitly changes it.

No package installation, server build, secrets or paid services are required by this static app. Only public/ is deployed. Source files in public/ can also be opened locally. The release includes an independent single-file copy for existing local use.

Google Fonts supplies the typefaces; task, payment and note data is never sent to it. The website has no analytics and disallows application network connections through its Content Security Policy.
