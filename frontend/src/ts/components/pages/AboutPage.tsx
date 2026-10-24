import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement } from "solid-js";

import {
  getContributorsQueryOptions,
  getSpeedHistogramQueryOptions,
  getTypingStatsQueryOptions,
} from "../../queries/public";
import { getActivePage } from "../../states/core";
import { showModal } from "../../states/modals";
import { getTheme } from "../../states/theme";
import { getNumberWithMagnitude } from "../../utils/numbers";
import { getProgcompSiteUrl } from "../../utils/progcomp";
import AsyncContent from "../common/AsyncContent";
import { Button } from "../common/Button";
import { ChartJs } from "../common/ChartJs";
import { H2, H3 } from "../common/Headers";
import { Page } from "../common/Page";
import { CommandlineHotkey } from "../hotkeys/CommandlineHotkey";
import { QuickRestartHotkey } from "../hotkeys/QuickRestartHotkey";

export function AboutPage(): JSXElement {
  const isOpen = () => getActivePage() === "about";

  const contributors = useQuery(() => ({
    ...getContributorsQueryOptions(),
    enabled: isOpen(),
  }));

  const typingStats = useQuery(() => ({
    ...getTypingStatsQueryOptions(),
    enabled: isOpen(),
  }));

  const speedHistogram = useQuery(() => ({
    ...getSpeedHistogramQueryOptions(),
    enabled: isOpen(),
  }));

  const numberOfHistogramRecords = (data?: { y: number }[]) => {
    if (data === undefined) return "";
    const sum = getNumberWithMagnitude(
      data.reduce((sum, it) => (sum += it.y), 0),
    );
    return `${sum.roundedTo2} ${sum.orderOfMagnitude}`;
  };

  return (
    <Page id="about">
      <div class="content-grid grid gap-8">
        <section class="grid justify-items-center gap-4 text-center text-sub">
          <img
            src="/images/progcompea/frog.png"
            alt="the progcompea frog typing on a laptop"
            class="w-48"
          />
          <div>
            The typing trainer of Programación Competitiva UChile.
            <br />
            Built on <a href="#credits_title">Monkeytype</a>, by Miodec and its
            contributors.
          </div>
        </section>
        <section>
          <AsyncContent
            alwaysShowContent
            queries={{ typingStats }}
            errorMessage="Failed to get global typing stats"
          >
            {({ typingStatsData }) => (
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <For
                  each={
                    [
                      [
                        "total tests started",
                        () => typingStatsData()?.testsStarted,
                      ],
                      [
                        "total typing time",
                        () => typingStatsData()?.timeTyping,
                      ],
                      [
                        "total tests completed",
                        () => typingStatsData()?.testsCompleted,
                      ],
                    ] as const
                  }
                >
                  {([title, stat]) => (
                    <div class="text-center">
                      <div class="text-sub">{title}</div>
                      <div class="text-5xl">{stat()?.text ?? "-"}</div>
                      <div class="text-xl">{stat()?.subText ?? "-"}</div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </AsyncContent>
        </section>
        <section class="h-48 w-full">
          <AsyncContent
            alwaysShowContent
            queries={{ speedHistogram }}
            errorMessage="Failed to get global speed stats for histogram"
          >
            {({ speedHistogramData }) => (
              <>
                <ChartJs
                  name="SpeedHistogram"
                  type="bar"
                  data={{
                    labels: speedHistogramData()?.labels ?? [],
                    datasets: [
                      {
                        yAxisID: "count",
                        label: "Users",
                        data: speedHistogramData()?.data ?? [],
                        minBarLength: 2,
                        backgroundColor: getTheme().main,
                        borderColor: getTheme().main,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    hover: {
                      mode: "nearest",
                      intersect: false,
                    },
                    scales: {
                      x: {
                        axis: "x",
                        bounds: "ticks",
                        display: true,
                        title: {
                          display: false,
                          text: "Bucket",
                        },
                        offset: true,
                      },
                      count: {
                        axis: "y",
                        beginAtZero: true,
                        min: 0,
                        ticks: {
                          autoSkip: true,
                          autoSkipPadding: 20,
                          stepSize: 10,
                        },
                        display: true,
                        title: {
                          display: true,
                          text: "Users",
                        },
                      },
                    },
                    plugins: {
                      annotation: {
                        annotations: [],
                      },
                      tooltip: {
                        animation: { duration: 250 },
                        intersect: false,
                        mode: "index",
                        callbacks: {
                          afterLabel: (context) => {
                            return (
                              (context.raw as { topPercentage?: string })
                                .topPercentage ?? ""
                            );
                          },
                        },
                      },
                    },
                  }}
                />
                <div class="text-right text-xs text-sub">
                  distribution of time 60 leaderboard results (wpm) <br />
                  {numberOfHistogramRecords(speedHistogramData()?.data)} total
                  results
                </div>
              </>
            )}
          </AsyncContent>
        </section>
        <section>
          <H2 fa={{ icon: "fa-info-circle" }} text="about" />
          <p>
            progcompea type is where the{" "}
            <a href={getProgcompSiteUrl()} target="_blank">
              ProgCompJOliva
            </a>{" "}
            community practices typing. Fast, accurate typing won&apos;t solve
            the problem for you, but it does mean less time between having the
            idea and getting an accepted verdict.
            <br />
            <br />
            You sign in with your ProgCompJOliva account. Your nickname,
            password and university are managed there, and your typing personal
            bests are shared with ProgCompJOliva.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-align-left" }} text="word set" />
          <p>
            By default, tests use ariasctl: the most common tokens of real
            competitive programming code (keywords, types, macros and the names
            we all use). handbook-usm does the same for the code of the{" "}
            <a
              href="https://github.com/ProgramacionCompetitivaUTFSM/Handbook-USM"
              target="_blank"
            >
              USM handbook
            </a>
            , and its quotes are the handbook&apos;s algorithms. English and
            many other languages are still available in the options.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-university" }} text="universities" />
          <p>
            The all-time leaderboards can be filtered by university. On the
            university leaderboard, each university is ranked by the average
            speed of its 3 fastest typists, like an ICPC team. A university with
            fewer than 3 typists counts the missing ones as 0 wpm, so bring your
            teammates.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-keyboard" }} text="keybinds" />
          <p>
            You can use <QuickRestartHotkey /> to restart the typing test. Open
            the command line by pressing <CommandlineHotkey /> - there you can
            access all the functionality you need without touching your mouse.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-list-ol" }} text="stats" />
          <dl class="grid">
            <dt class="col-1 mr-4">wpm</dt>
            <dd class="col-2">
              - total number of characters in the correctly typed words
              (including spaces), divided by 5 and normalised to 60 seconds.
            </dd>

            <dt class="col-1 mr-4">raw wpm</dt>
            <dd class="col-2">
              {" "}
              - calculated just like wpm, but also includes incorrect words.
            </dd>

            <dt class="col-1 mr-4">acc</dt>
            <dd class="col-2"> - percentage of correctly pressed keys.</dd>

            <dt class="col-1 mr-4">char</dt>
            <dd class="col-2">
              - correct characters / incorrect characters. Calculated after the
              test has ended.
            </dd>

            <dt class="col-1 mr-4">consistency</dt>
            <dd class="col-2">
              - based on the variance of your raw wpm. Closer to 100% is better.
              Calculated using the coefficient of variation of raw wpm and
              mapped onto a scale from 0 to 100.
            </dd>
          </dl>
        </section>
        <section>
          <H3 fa={{ icon: "fa-chart-area" }} text="results screen" />
          <p>
            After completing a test you will be able to see your wpm, raw wpm,
            accuracy, character stats, test length, leaderboards info and test
            info (you can hover over some values to get floating point numbers).
            You can also see a graph of your wpm and raw over the duration of
            the test. Remember that the wpm line is a global average, while the
            raw wpm line is a local, momentary value (meaning if you stop, the
            value is 0).
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-bug" }} text="bug report or feature request" />
          <p>
            If you encounter a bug or have a feature request, talk to the
            ProgCompJOliva admins.
          </p>
          <div class="mt-4 grid w-full grid-cols-1 gap-4 text-xl sm:grid-cols-2">
            <Button
              text="contact"
              fa={{ icon: "fa-envelope" }}
              onClick={() => showModal("Contact")}
              class="w-full p-8"
            />
            <Button
              text="ProgCompJOliva"
              fa={{ icon: "fa-external-link-alt" }}
              href={getProgcompSiteUrl()}
              class="w-full p-8"
            />
          </div>
        </section>
        <div></div>
        <section>
          <H2 id="credits_title" fa={{ icon: "fa-users" }} text="credits" />
          <p>
            This site is a fork of{" "}
            <Button
              variant="text"
              text="Monkeytype"
              href="https://github.com/monkeytypegame/monkeytype"
              class="p-0"
            />
            , a minimalistic and customizable typing test created by Miodec and
            released under the GPL-3.0 license. All the credit for the typing
            test goes to Monkeytype and its contributors. If you like it,
            consider{" "}
            <Button
              variant="text"
              text="supporting Monkeytype"
              onClick={() => showModal("Support")}
              class="p-0"
            />
            .
          </p>
        </section>
        <div></div>
        <section>
          <H2
            id="contributors_title"
            fa={{ icon: "fa-code-branch" }}
            text="monkeytype contributors"
          />
          <AsyncContent
            queries={{ contributors }}
            errorMessage="Failed to get contributors"
          >
            {({ contributorsData }) => (
              <div
                class="grid"
                style={{
                  "grid-template-columns":
                    "repeat(auto-fill, minmax(13em, 1fr))",
                }}
              >
                <For each={contributorsData()}>
                  {(name) => <div>{name}</div>}
                </For>
              </div>
            )}
          </AsyncContent>
        </section>
      </div>
    </Page>
  );
}
