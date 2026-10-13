import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideHome, LucideUsersRound, LucideUserRound } from '@lucide/angular';

@Component({
  selector: 'nexus-split-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideHome, LucideUsersRound, LucideUserRound],
  template: `<nav class="split-bottom-nav" aria-label="主要导航">
    <a routerLink="/split/home" routerLinkActive="active"><svg lucideHome></svg><span>首页</span></a>
    <a routerLink="/split/groups" routerLinkActive="active"><svg lucideUsersRound></svg><span>群组</span></a>
    <a routerLink="/split/settings" routerLinkActive="active"><svg lucideUserRound></svg><span>我的</span></a>
  </nav>`,
  styleUrls: ['./split-ui.scss'],
})
export class SplitBottomNavComponent {}
