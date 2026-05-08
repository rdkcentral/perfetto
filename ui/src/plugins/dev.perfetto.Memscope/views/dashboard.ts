// Copyright (C) 2026 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import m from 'mithril';
import {App} from '../../../public/app';
import {Button, ButtonVariant} from '../../../widgets/button';
import {Intent} from '../../../widgets/common';
import {
  SegmentedButton,
  SegmentedButtons,
} from '../../../widgets/segmented_buttons';
import {GateDetector} from '../../../base/mithril_utils';
import {LiveSession} from '../sessions/live_session';
import {ProcessesTab} from './tabs/processes';
import {renderSystemTab} from './tabs/system';
import {renderPageCacheTab} from './tabs/page_cache';
import {renderPressureSwapTab} from './tabs/pressure_swap';
import {Chip} from '../../../widgets/chip';
import {Tooltip} from '../../../widgets/tooltip';
import {PopupPosition} from '../../../widgets/popup';
import {Icon} from '../../../widgets/icon';

type Tab = 'processes' | 'system' | 'file_cache' | 'pressure_swap';

interface DashboardAttrs {
  readonly app: App;
  readonly session: LiveSession;
  readonly onStopped: () => void;
}

export class Dashboard implements m.ClassComponent<DashboardAttrs> {
  private activeTab: Tab = 'processes';

  view({attrs}: m.CVnode<DashboardAttrs>) {
    const {session} = attrs;
    return m(
      GateDetector,
      {
        onVisibilityChanged: (visible) =>
          visible ? session.resume() : session.pause(),
      },
      m(
        '.pf-memscope-page__container',
        m(
          '.pf-memscope-page',
          this.renderTitleBar(attrs),
          this.renderDashboard(attrs),
        ),
      ),
    );
  }

  private renderTitleBar(attrs: DashboardAttrs): m.Children {
    const {session} = attrs;
    return m(
      '.pf-memscope-title-bar',
      m(
        '.pf-memscope-title-bar__left',
        m('h1', 'Memscope'),
        m('.pf-memscope-title-bar__sep'),
        this.renderSessionPill(attrs),
      ),
      m(
        '.pf-memscope-title-bar__actions',
        m(Button, {
          label: 'Stop & Open Trace',
          icon: 'open_in_new',
          variant: ButtonVariant.Filled,
          disabled: session.lastTraceBuffer === undefined,
          onclick: () => this.stopAndOpenTrace(attrs),
        }),
        m(Button, {
          icon: 'usb_off',
          label: 'Disconnect',
          minimal: true,
          variant: ButtonVariant.Filled,
          onclick: () => attrs.onStopped(),
        }),
      ),
    );
  }

  private renderSessionPill(attrs: DashboardAttrs): m.Children {
    const {session} = attrs;
    return m(
      '.pf-memscope-session-pill',
      // Device identity.
      m(
        '.pf-memscope-session-pill__device',
        m('.pf-memscope-status-bar__dot', {
          class: session.isPaused ? 'pf-memscope-status-bar__dot--paused' : '',
        }),
        m('span', session.deviceName),
        session.data?.isUserDebug &&
          m(Chip, {label: 'userdebug', intent: Intent.Warning}),
      ),
      m('.pf-memscope-session-pill__sep'),
      // Snapshot counter with timing tooltip.
      m(
        Tooltip,
        {
          trigger: m(
            '.pf-memscope-session-pill__snapshot',
            m(Icon, {icon: 'photo_camera'}),
            m('span', `#${session.snapshotCount}`),
          ),
          position: PopupPosition.Bottom,
        },
        m(
          '.pf-memscope-snapshot-info',
          session.lastSnapshotMs > 0
            ? [
                m('.pf-memscope-snapshot-info__heading', 'Snapshot'),
                m(
                  '.pf-memscope-snapshot-info__row',
                  m('span', 'Size'),
                  m('span', `${session.lastSnapshotSizeKb.toFixed(0)}kB`),
                ),
                session.lastBufferUsagePct !== undefined &&
                  m(
                    '.pf-memscope-snapshot-info__row',
                    m('span', 'Buffer usage'),
                    m('span', `${session.lastBufferUsagePct.toFixed(1)}%`),
                  ),
                session.data !== undefined && [
                  m('.pf-memscope-snapshot-info__heading', 'Counter range'),
                  m(
                    '.pf-memscope-snapshot-info__row',
                    m('span', 'First sample'),
                    m('span', `${session.data.xMin.toFixed(1)}s`),
                  ),
                  m(
                    '.pf-memscope-snapshot-info__row',
                    m('span', 'Last sample'),
                    m('span', `${session.data.xMax.toFixed(1)}s`),
                  ),
                ],
                m('.pf-memscope-snapshot-info__heading', 'Timings'),
                m(
                  '.pf-memscope-snapshot-info__row',
                  m('span', 'Clone'),
                  m('span', `${session.lastCloneMs}ms`),
                ),
                m(
                  '.pf-memscope-snapshot-info__row',
                  m('span', 'Parse'),
                  m('span', `${session.lastParseMs}ms`),
                ),
                m(
                  '.pf-memscope-snapshot-info__row',
                  m('span', 'Query'),
                  m('span', `${session.lastQueryMs}ms`),
                ),
                m(
                  '.pf-memscope-snapshot-info__row',
                  m('span', 'Extract'),
                  m('span', `${session.lastExtractMs}ms`),
                ),
                m(
                  '.pf-memscope-snapshot-info__row.pf-memscope-snapshot-info__sum',
                  m('span', 'Total'),
                  m('span', `${session.lastSnapshotMs}ms`),
                ),
                session.snapshotOverrun &&
                  m(
                    '.pf-memscope-snapshot-info__overrun',
                    m('span.material-icons', 'warning'),
                    'Exceeds interval — increase snapshot rate',
                  ),
              ]
            : m(
                '.pf-memscope-snapshot-info__empty',
                'Waiting for snapshot\u2026',
              ),
        ),
      ),
      m('.pf-memscope-session-pill__sep'),
      // Pause / Resume — embedded inside the pill.
      m(Button, {
        rounded: true,
        label: session.isPaused ? 'Resume' : 'Pause',
        icon: session.isPaused ? 'play_arrow' : 'pause',
        intent: session.isPaused ? Intent.Success : Intent.Warning,
        onclick: () => {
          session.togglePause();
          m.redraw();
        },
      }),
    );
  }

  private renderDashboard(attrs: DashboardAttrs): m.Children {
    const {session} = attrs;
    return [
      // Tab strip.
      m(
        '.pf-memscope-tabs',
        m(
          SegmentedButtons,
          {
            intent: Intent.Primary,
            selectedValue: this.activeTab,
            onOptionSelected: (value: string) => {
              this.activeTab = value as Tab;
            },
          },
          m(SegmentedButton, {value: 'processes', icon: 'apps'}, 'Processes'),
          m(SegmentedButton, {value: 'system', icon: 'monitoring'}, 'System'),
          m(
            SegmentedButton,
            {value: 'file_cache', icon: 'file_copy'},
            'Page Cache',
          ),
          m(
            SegmentedButton,
            {value: 'pressure_swap', icon: 'speed'},
            'Pressure, Faults & Swap',
          ),
        ),
      ),

      // Tab content.
      this.activeTab === 'processes' && m(ProcessesTab, {session}),
      this.activeTab === 'system' && renderSystemTab(session),
      this.activeTab === 'file_cache' && renderPageCacheTab(session),
      this.activeTab === 'pressure_swap' && renderPressureSwapTab(session),
      !session.data && m('.pf-memscope-placeholder', 'Waiting for data\u2026'),
    ];
  }

  private async stopAndOpenTrace(attrs: DashboardAttrs) {
    const buffer = attrs.session.lastTraceBuffer;
    if (buffer === undefined) return;
    const fileName = `live-memory-${Date.now()}.perfetto-trace`;
    await attrs.session.dispose();
    attrs.app.openTraceFromBuffer({buffer, title: fileName, fileName});
  }
}
