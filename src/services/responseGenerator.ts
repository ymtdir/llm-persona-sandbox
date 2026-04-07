import type { Character, Post, ChatMessage, ChatOptions } from '../types';
import { CharacterSelector } from './characterSelector';
import { OllamaClient } from './ollamaClient';
import { PostManager } from './postManager';

/**
 * スレッド履歴の最大表示件数
 */
const MAX_HISTORY_LENGTH = 20;

/**
 * デフォルトのOllamaモデル名
 */
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * デフォルトのレス生成トークン数
 */
const DEFAULT_NUM_PREDICT = 200;

/**
 * ResponseGenerator
 *
 * AIキャラクターによるレス生成を統括するクラス。
 * キャラクター選択、プロンプト構築、Ollama API呼び出し、レス保存の一連のフローを制御。
 */
export class ResponseGenerator {
  private characterSelector: CharacterSelector;
  private ollamaClient: OllamaClient;
  private postManager: PostManager;

  constructor(
    characterSelector: CharacterSelector,
    ollamaClient: OllamaClient,
    postManager: PostManager
  ) {
    this.characterSelector = characterSelector;
    this.ollamaClient = ollamaClient;
    this.postManager = postManager;
  }

  /**
   * AIレス生成
   *
   * ユーザー投稿に対して2-5体のAIキャラクターがレスを生成する。
   * 各キャラクターのレス生成は並行して実行され、エラーが発生しても他のキャラクターの生成は継続される。
   *
   * @param threadId - スレッドID
   * @param userPost - ユーザー投稿内容
   * @param threadHistory - スレッド履歴（最新20件推奨）
   * @returns 生成されたレスの配列
   */
  async generateResponses(
    threadId: string,
    userPost: Post,
    threadHistory: Post[]
  ): Promise<Post[]> {
    console.log('[INFO] ResponseGenerator: Starting AI response generation', {
      threadId,
      userPostNumber: userPost.postNumber,
      historyLength: threadHistory.length,
    });

    try {
      // キャラクター選択（2-5体）
      const selectedCharacters = this.characterSelector.selectCharacters(userPost.content);

      console.log('[INFO] ResponseGenerator: Selected characters', {
        count: selectedCharacters.length,
        characters: selectedCharacters.map((c) => c.displayName),
      });

      // 各キャラクターごとにレス生成（並行処理）
      const generatePromises = selectedCharacters.map((character) =>
        this.generateIndividual(character, threadHistory, userPost, threadId).catch((error) => {
          // エラーが発生しても他のキャラクターの生成は継続
          console.error(
            `[ERROR] ResponseGenerator: Failed to generate response for ${character.displayName}`,
            error
          );
          return null;
        })
      );

      // 全キャラクターのレス生成を待機
      const results = await Promise.all(generatePromises);

      // null（エラー）を除外
      const generatedPosts = results.filter((post): post is Post => post !== null);

      console.log('[INFO] ResponseGenerator: AI response generation completed', {
        successCount: generatedPosts.length,
        failureCount: selectedCharacters.length - generatedPosts.length,
      });

      return generatedPosts;
    } catch (error) {
      console.error('[ERROR] ResponseGenerator: AI response generation failed', error);
      throw error;
    }
  }

  /**
   * 個別キャラクターのレス生成
   *
   * System PromptとUser Promptを構築し、Ollama APIでレスを生成してDBに保存。
   *
   * @param character - キャラクター
   * @param threadHistory - スレッド履歴
   * @param userPost - ユーザー投稿
   * @param threadId - スレッドID
   * @returns 生成されたレス
   */
  private async generateIndividual(
    character: Character,
    threadHistory: Post[],
    userPost: Post,
    threadId: string
  ): Promise<Post> {
    console.log(`[INFO] ResponseGenerator: Generating response for ${character.displayName}`);

    // System Prompt構築
    const systemPrompt = this.buildSystemPrompt(character);

    // User Prompt構築
    const userPrompt = this.buildUserPrompt(threadHistory, userPost);

    // ChatMessage配列
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // ChatOptions
    const options: ChatOptions = {
      temperature: character.temperature,
      num_predict: DEFAULT_NUM_PREDICT,
    };

    // Ollama APIへリクエスト
    const response = await this.ollamaClient.chat(DEFAULT_MODEL, messages, options);

    // 生成されたレス内容
    const generatedContent = response.message.content.trim();

    console.log(
      `[INFO] ResponseGenerator: Generated response for ${character.displayName}`,
      {
        contentLength: generatedContent.length,
      }
    );

    // レスをDBに保存
    const post = await this.postManager.createPost({
      threadId,
      content: generatedContent,
      authorName: character.displayName,
      characterId: character.id,
      isUserPost: false,
    });

    return post;
  }

  /**
   * System Prompt構築
   *
   * キャラクターのペルソナ設定、口調、ルールをSystem Promptとして構築。
   *
   * @param character - キャラクター
   * @returns System Prompt
   */
  private buildSystemPrompt(character: Character): string {
    return `あなたは2chの「${character.displayName}」です。

性格:
${character.personality}

口調:
${character.speechStyle}

ルール:
- 必ず上記の性格・口調を守ってレスしてください
- レス番号のアンカー（>>1, >>3等）を自然に使ってください
- 簡潔に2-3行程度でレスしてください
- 2ch特有の表現（草、ｗｗｗ、定型文等）を使ってください`;
  }

  /**
   * User Prompt構築
   *
   * スレッド履歴と最新の投稿を組み合わせてUser Promptを構築。
   *
   * @param threadHistory - スレッド履歴
   * @param userPost - ユーザー投稿
   * @returns User Prompt
   */
  private buildUserPrompt(threadHistory: Post[], userPost: Post): string {
    // スレッド履歴をフォーマット
    const formattedHistory = this.formatThreadHistory(threadHistory);

    return `以下のスレッドに対して、レスしてください。

スレッド履歴:
${formattedHistory}

最新の投稿:
${userPost.postNumber}: ${userPost.authorName}: ${userPost.content}

あなたのレス（本文のみ、レス番号不要）:`;
  }

  /**
   * スレッド履歴を2ch風テキスト形式に変換
   *
   * @param posts - レス一覧
   * @returns 2ch風テキスト形式
   */
  private formatThreadHistory(posts: Post[]): string {
    // 最新N件に制限
    const recentPosts = posts.slice(-MAX_HISTORY_LENGTH);

    // 2ch風フォーマットに変換
    return recentPosts
      .map((post) => `${post.postNumber}: ${post.authorName}: ${post.content}`)
      .join('\n');
  }
}
