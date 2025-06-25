// A Dagger module to test Powerbuddy.

package main

import (
	"context"
	"dagger/powerbuddy/internal/dagger"
	"fmt"
	"strings"
)

type Powerbuddy struct{}

// Build a development environment
func (m *Powerbuddy) BuildEnv(
	ctx context.Context,
	// +defaultPath="/"
	source *dagger.Directory,
) (*dagger.Container, error) {
	nodeVersionFile := source.File("worker/.node-version")
	nodeVersion, err := nodeVersionFile.Contents(ctx)
	if err != nil {
		return nil, err
	}
	nodeVersion = strings.TrimSpace(nodeVersion)
	nodeBase := fmt.Sprintf("node:%s-slim", nodeVersion)
	// TODO cache
	return dag.Container().
		From(nodeBase).
		WithDirectory("/src", source).
		WithWorkdir("/src/worker").
		WithExec([]string{"yarn"}), nil
}

// Runs tests
func (m *Powerbuddy) Test(
	ctx context.Context,
	// +defaultPath="/"
	source *dagger.Directory,
) (string, error) {
	buildEnv, err := m.BuildEnv(ctx, source)
	if err != nil {
		return "", err
	}
	return buildEnv.
		WithExec([]string{"yarn", "test", "--run"}).
		Stdout(ctx)
}
