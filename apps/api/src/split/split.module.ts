import { Module } from '@nestjs/common';
import { Argon2SplitPasswordHasher } from './auth/password/argon2-split-password-hasher.js';
import { SPLIT_PASSWORD_HASHER } from './auth/password/split-password-hasher.js';
import { PostgresSplitAuthRepository } from './auth/persistence/postgres-split-auth.repository.js';
import { SPLIT_AUTH_REPOSITORY } from './auth/persistence/split-auth.repository.js';
import { defaultSplitAuthRuntime, SPLIT_AUTH_RUNTIME } from './auth/session/split-session.js';
import { SplitAuthController } from './auth/split-auth.controller.js';
import { SplitAuthGuard } from './auth/split-auth.guard.js';
import { SplitAuthService } from './auth/split-auth.service.js';
import { SplitOriginGuard } from './auth/split-origin.guard.js';
import { SplitCsrfService, splitCsrfSecret } from './auth/session/split-csrf.service.js';
import { SplitCsrfGuard } from './auth/split-csrf.guard.js';
import { SplitGroupsController } from './groups/split-groups.controller.js';
import { SplitGroupsService } from './groups/split-groups.service.js';
import { SplitMembersController } from './members/split-members.controller.js';
import { SplitMembersService } from './members/split-members.service.js';
import { SplitInvitesController } from './invites/split-invites.controller.js';
import { SplitInvitesService } from './invites/split-invites.service.js';
import { PostgresSplitRepository } from './persistence/postgres-split.repository.js';
import { SPLIT_DOMAIN_RUNTIME, SPLIT_REPOSITORY } from './persistence/split.repository.js';
import { defaultSplitDomainRuntime } from './split-domain.runtime.js';
import { SplitExpensesController } from './expenses/split-expenses.controller.js';
import { SplitExpensesService } from './expenses/split-expenses.service.js';
import { SplitBalancesController } from './balances/split-balances.controller.js';
import { SplitBalancesService } from './balances/split-balances.service.js';
import { SplitSettlementsController } from './settlements/split-settlements.controller.js';
import { SplitSettlementsService } from './settlements/split-settlements.service.js';
import { SplitActivityController } from './activity/split-activity.controller.js';
import { SplitActivityService } from './activity/split-activity.service.js';
import { SplitExchangeRateController } from './fx/split-exchange-rate.controller.js';
import { FrankfurterSplitExchangeRateProvider, SplitExchangeRateService } from './fx/split-exchange-rate.service.js';

@Module({
  controllers: [
    SplitAuthController,
    SplitGroupsController,
    SplitMembersController,
    SplitInvitesController,
    SplitExpensesController,
    SplitBalancesController,
    SplitSettlementsController,
    SplitActivityController,
    SplitExchangeRateController,
  ],
  providers: [
    SplitAuthService,
    SplitAuthGuard,
    SplitOriginGuard,
    SplitCsrfGuard,
    SplitGroupsService,
    SplitMembersService,
    SplitInvitesService,
    SplitExpensesService,
    SplitBalancesService,
    SplitSettlementsService,
    SplitActivityService,
    SplitExchangeRateService,
    FrankfurterSplitExchangeRateProvider,
    { provide: SplitCsrfService, useFactory: () => new SplitCsrfService(splitCsrfSecret()) },
    { provide: SPLIT_AUTH_REPOSITORY, useClass: PostgresSplitAuthRepository },
    { provide: SPLIT_PASSWORD_HASHER, useClass: Argon2SplitPasswordHasher },
    { provide: SPLIT_AUTH_RUNTIME, useValue: defaultSplitAuthRuntime },
    { provide: SPLIT_REPOSITORY, useClass: PostgresSplitRepository },
    { provide: SPLIT_DOMAIN_RUNTIME, useValue: defaultSplitDomainRuntime },
  ],
})
export class SplitModule {}
