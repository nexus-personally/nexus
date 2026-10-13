import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SplitOfflineNoticeComponent } from './split/ui/split-offline-notice.component';

@Component({
  selector: 'nexus-root',
  standalone: true,
  imports: [RouterOutlet, SplitOfflineNoticeComponent],
  template: '<router-outlet /><nexus-split-offline-notice />',
})
export class AppComponent {}
