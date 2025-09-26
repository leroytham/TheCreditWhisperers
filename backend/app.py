# streamlit_app.py
import streamlit as st
import plotly.graph_objects as go
from streamlit_plotly_events import plotly_events
import plotly.express as px
from data_processing import get_data, filter_data, get_ticker_news, analyze_sentiment, detect_large_moves, fetch_news_around_date

st.set_page_config(page_title="Ticker Dashboard", layout="wide")
st.title("Stock Price & News Dashboard")

# ------------------------------
# 1. Ticker input
# ------------------------------
ticker_input = st.text_input("Enter Ticker Symbol:", value="AAPL").upper()

if ticker_input:
    # ------------------------------
    # 2. Get price data
    # ------------------------------
    df = get_data(ticker_input)
    if df is None or df.empty:
        st.warning(f"No price data found for {ticker_input}")
    else:
        # ------------------------------
        # 3. Timeframe selection
        # ------------------------------
        timeframe = st.selectbox("Select Timeframe:", ["1M", "3M", "6M", "1Y"])
        df_filtered = filter_data(df, timeframe)

        # ------------------------------
        # 4. Fetch news & sentiment (once per ticker)
        # ------------------------------
        @st.cache_data(show_spinner=False)
        def fetch_news_and_sentiment(ticker):
            news_articles = get_ticker_news(ticker, count=198)
            return analyze_sentiment(news_articles)

        news_with_sentiment, avg_score, sentiment_counts, daily_avg_sentiment = fetch_news_and_sentiment(ticker_input)

        # ------------------------------
        # 5. Create 3-1 column layout
        # ------------------------------
        col1, col2 = st.columns([3, 1])

        with col1:
            st.subheader(f"{ticker_input} Price Chart ({timeframe})")
            # fig = px.line(df_filtered, x=df_filtered.index, y="Close", title=f"{ticker_input} Close Price")
            # st.plotly_chart(fig, use_container_width=True)
            # Detect top 3 large moves in the selected timeframe
            large_moves = detect_large_moves(df_filtered, top_n=3)

            # Create base line chart
            fig = go.Figure()

            fig.add_trace(go.Scatter(
                x=df_filtered.index,
                y=df_filtered["Close"],
                mode="lines",
                name="Close Price",
                line=dict(color="blue")
            ))

            # Add markers for large moves
            for move in large_moves:
                move_date = move["date"]
                # Find the close price on that date
                if move_date in df_filtered.index.strftime("%Y-%m-%d"):
                    y_val = df_filtered.loc[df_filtered.index.strftime("%Y-%m-%d") == move_date, "Close"].values[0]

                    fig.add_trace(go.Scatter(
                        x=[move_date],
                        y=[y_val],
                        mode="markers+text",
                        name=f"{move['pct_change']:.2f}%",
                        marker=dict(
                            size=12,
                            color="red" if move["pct_change"] < 0 else "green",
                            symbol="circle"
                        ),
                        text=[f"{move['pct_change']:.2f}%"],
                        textposition="top center"
                    ))

            fig.update_layout(
                title=f"{ticker_input} Close Price with Significant Moves ({timeframe})",
                xaxis_title="Date",
                yaxis_title="Close Price",
                hovermode="x unified"
            )

            # st.plotly_chart(fig, use_container_width=True)
            selected_points = plotly_events(
                                        fig,
                                        click_event=True,
                                        hover_event=False,
                                        select_event=False,
                                        key="price_chart"
                                    )

            if selected_points:
                clicked_date = selected_points[0]["x"]  # this is the date string from Plotly
                st.subheader(f"News around {clicked_date}")

                related_news = fetch_news_around_date(ticker_input, clicked_date, window=2, count=100)

                if related_news:
                    for article in related_news:
                        st.markdown(
                            f"- [{article['title']}]({article['link']}) "
                            f"({article['publish_date']}, {article['provider']})"
                        )
                else:
                    st.write("No news found near this date.")



        with col2:
            st.subheader(f"Related News (Past 7 Days)")

            # Scrollable container using st.markdown and CSS
            st.markdown(
                """
                <style>
                .scrollable-news {
                    max-height: 600px;  /* adjust based on chart height */
                    overflow-y: auto;
                    padding-right: 10px;
                }
                .positive {color: green; font-weight: bold;}
                .neutral {color: gray; font-weight: bold;}
                .negative {color: red; font-weight: bold;}
                </style>
                """, unsafe_allow_html=True
            )

            news_html = "<div class='scrollable-news'>"
            for article in news_with_sentiment:
                label = article["sentiment_label"].lower()
                score = article["sentiment_score"]
                news_html += f"<p><a href='{article['link']}' target='_blank'><strong>{article['title']}</strong></a><br>"
                news_html += f"<span class='{label}'>{label.capitalize()} [{score:.2f}]</span></p><hr>"
            news_html += "</div>"

            st.markdown(news_html, unsafe_allow_html=True)

        # ------------------------------
        # 6. Show overall average sentiment score
        # ------------------------------
        st.markdown(f"### Overall Average Sentiment Score: {avg_score:.2f}")

        # ------------------------------
        # 7. Show daily average sentiment bar chart
        # ------------------------------
        st.subheader("Daily Average Sentiment (Past 7 Days)")
        daily_dates = list(daily_avg_sentiment.keys())
        daily_scores = list(daily_avg_sentiment.values())
        bar_fig = px.bar(
            x=daily_dates,
            y=daily_scores,
            labels={"x": "Date", "y": "Average Sentiment Score"},
            color=daily_scores,
            color_continuous_scale=["red", "gray", "green"],
            title="Daily Average Sentiment"
        )
        st.plotly_chart(bar_fig, use_container_width=True)


                # ------------------------------
        # 8. Show significant price moves & related news
        # ------------------------------
        st.subheader(f"Significant Price Moves & Related News ({timeframe})")

        large_moves = detect_large_moves(df_filtered, top_n=3)  # biggest 3 moves in the selected timeframe

        if large_moves:
            for move in large_moves:
                st.markdown(f"**{move['date']}** → {move['pct_change']:.2f}%")

                # Fetch related news (±2 days from move date)
                related_news = fetch_news_around_date(ticker_input, move["date"], window=2, count=100)

                if related_news:
                    for article in related_news:
                        st.markdown(
                            f"- [{article['title']}]({article['link']}) "
                            f"({article['publish_date']}, {article['provider']})"
                        )
                else:
                    st.write("No news found near this date.")
        else:
            st.write("No significant moves detected.")

