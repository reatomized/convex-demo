import { m } from '#paraglide/messages.js'
import { withMatchHeaderTrail } from '#shared/model'

import { teamRoute } from './model/routes'

teamRoute.match.extend(withMatchHeaderTrail(1, { label: () => m.nav_team() }))

export { TeamNavItem } from './ui/TeamNavItem'
